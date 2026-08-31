export type YoutubeQuotaBucket = "general" | "search_queries" | "batch_get_stats";

export type YoutubeApiConsumer =
  | "intraday_statistics"
  | "channel_importer"
  | "upload_playlist_importer"
  | "protected_validation"
  | "protected_validation_search"
  | "daily_video_snapshots"
  | "daily_channel_snapshots"
  | "official_shadow_discovery"
  | "admin_youtube";

type PgClient = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

export const YOUTUBE_QUOTA_LIMITS: Record<YoutubeQuotaBucket, number> = {
  general: 10_000,
  search_queries: 100,
  batch_get_stats: 10_000,
};

let budgetTablesEnsured = false;

export function youtubeQuotaCharges(method: string, requests = 1): Array<{
  bucket: YoutubeQuotaBucket;
  amount: number;
}> {
  const count = Math.max(0, Math.floor(requests));
  if (method === "search.list") {
    return [
      { bucket: "general", amount: 100 * count },
      { bucket: "search_queries", amount: count },
    ];
  }
  if (method === "videos.batchGetStats") {
    return [{ bucket: "batch_get_stats", amount: count }];
  }
  return [{ bucket: "general", amount: count }];
}

export function youtubeQuotaCanReserve(
  current: Partial<Record<YoutubeQuotaBucket, number>>,
  method: string,
  requests = 1,
) {
  return youtubeQuotaCharges(method, requests).every(({ bucket, amount }) =>
    Number(current[bucket] ?? 0) + amount <= YOUTUBE_QUOTA_LIMITS[bucket],
  );
}

export async function ensureYoutubeApiBudgetTables(client: PgClient) {
  if (budgetTablesEnsured) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_api_quota_daily (
      usage_date date NOT NULL,
      quota_bucket text NOT NULL CHECK (quota_bucket IN ('general','search_queries','batch_get_stats')),
      used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (usage_date, quota_bucket)
    );
    CREATE TABLE IF NOT EXISTS youtube_api_usage_ledger (
      usage_date date NOT NULL,
      consumer text NOT NULL,
      method text NOT NULL,
      quota_bucket text NOT NULL CHECK (quota_bucket IN ('general','search_queries','batch_get_stats')),
      requests integer NOT NULL DEFAULT 0 CHECK (requests >= 0),
      quota_units integer NOT NULL DEFAULT 0 CHECK (quota_units >= 0),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (usage_date, consumer, method, quota_bucket)
    );
    CREATE TABLE IF NOT EXISTS youtube_api_quota_baselines (
      usage_date date NOT NULL,
      source text NOT NULL,
      captured_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (usage_date, source)
    );
    CREATE OR REPLACE VIEW youtube_api_daily_usage AS
    SELECT
      ledger.usage_date,
      ledger.consumer,
      ledger.method,
      ledger.quota_bucket,
      ledger.requests,
      ledger.quota_units,
      quota.used bucket_used,
      CASE quota.quota_bucket
        WHEN 'general' THEN 10000
        WHEN 'search_queries' THEN 100
        WHEN 'batch_get_stats' THEN 10000
      END bucket_limit,
      GREATEST(0, CASE quota.quota_bucket
        WHEN 'general' THEN 10000
        WHEN 'search_queries' THEN 100
        WHEN 'batch_get_stats' THEN 10000
      END - quota.used) bucket_remaining,
      GREATEST(ledger.updated_at, quota.updated_at) updated_at
    FROM youtube_api_usage_ledger ledger
    JOIN youtube_api_quota_daily quota
      ON quota.usage_date=ledger.usage_date AND quota.quota_bucket=ledger.quota_bucket;
  `);
  budgetTablesEnsured = true;
}

export async function bootstrapYoutubeApiUsage(client: PgClient, source: "collector" | "validation") {
  await ensureYoutubeApiBudgetTables(client);
  await client.query("BEGIN");
  try {
    const claimed = await client.query(`
      INSERT INTO youtube_api_quota_baselines (usage_date,source)
      VALUES (CURRENT_DATE,$1)
      ON CONFLICT DO NOTHING RETURNING source
    `, [source]);
    if (!claimed.rows[0]) {
      await client.query("COMMIT");
      return;
    }
    const rows = source === "collector"
      ? await client.query<{ method: string; bucket: YoutubeQuotaBucket; requests: number; units: number }>(`
          SELECT 'legacy.general' method,'general' bucket,api_calls requests,api_calls units
          FROM youtube_shadow_api_usage WHERE usage_date=CURRENT_DATE::text AND api_calls>0
          UNION ALL
          SELECT 'videos.batchGetStats','batch_get_stats',batch_stats_api_calls,batch_stats_api_calls
          FROM youtube_shadow_api_usage WHERE usage_date=CURRENT_DATE::text AND batch_stats_api_calls>0
        `)
      : await client.query<{ method: string; bucket: YoutubeQuotaBucket; requests: number; units: number }>(`
          SELECT 'legacy.validation' method,'general' bucket,
            channel_calls+playlist_calls+video_calls requests,
            channel_calls+playlist_calls+video_calls units
          FROM youtube_discovery_validation_api_usage
          WHERE usage_date=CURRENT_DATE AND channel_calls+playlist_calls+video_calls>0
          UNION ALL
          SELECT 'search.list','general',search_request_attempts,search_request_attempts*100
          FROM youtube_discovery_validation_api_usage
          WHERE usage_date=CURRENT_DATE AND search_request_attempts>0
          UNION ALL
          SELECT 'search.list','search_queries',search_request_attempts,search_request_attempts
          FROM youtube_discovery_validation_api_usage
          WHERE usage_date=CURRENT_DATE AND search_request_attempts>0
        `);
    for (const row of rows.rows) {
      await client.query(`
        INSERT INTO youtube_api_usage_ledger
          (usage_date,consumer,method,quota_bucket,requests,quota_units)
        VALUES (CURRENT_DATE,$1,$2,$3,$4,$5)
        ON CONFLICT (usage_date,consumer,method,quota_bucket) DO UPDATE SET
          requests=youtube_api_usage_ledger.requests+excluded.requests,
          quota_units=youtube_api_usage_ledger.quota_units+excluded.quota_units,
          updated_at=now()
      `, [`legacy_${source}`, row.method, row.bucket, row.requests, row.units]);
      await client.query(`
        INSERT INTO youtube_api_quota_daily (usage_date,quota_bucket,used)
        VALUES (CURRENT_DATE,$1,$2)
        ON CONFLICT (usage_date,quota_bucket) DO UPDATE SET
          used=youtube_api_quota_daily.used+excluded.used,updated_at=now()
      `, [row.bucket, row.units]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

export async function reserveYoutubeApiUsage(client: PgClient, input: {
  consumer: YoutubeApiConsumer;
  method: string;
  requests?: number;
}) {
  const requests = Math.max(1, Math.floor(input.requests ?? 1));
  const charges = youtubeQuotaCharges(input.method, requests);
  await ensureYoutubeApiBudgetTables(client);
  await client.query("BEGIN");
  try {
    for (const { bucket, amount } of charges) {
      await client.query(`
        INSERT INTO youtube_api_quota_daily (usage_date,quota_bucket,used)
        VALUES (CURRENT_DATE,$1,0)
        ON CONFLICT DO NOTHING
      `, [bucket]);
      const reserved = await client.query<{ used: number }>(`
        UPDATE youtube_api_quota_daily
        SET used=used+$2,updated_at=now()
        WHERE usage_date=CURRENT_DATE AND quota_bucket=$1
          AND used+$2 <= $3
        RETURNING used
      `, [bucket, amount, YOUTUBE_QUOTA_LIMITS[bucket]]);
      if (!reserved.rows[0]) {
        throw new Error(`Internal YouTube ${bucket} daily budget exhausted.`);
      }
      await client.query(`
        INSERT INTO youtube_api_usage_ledger
          (usage_date,consumer,method,quota_bucket,requests,quota_units)
        VALUES (CURRENT_DATE,$1,$2,$3,$4,$5)
        ON CONFLICT (usage_date,consumer,method,quota_bucket) DO UPDATE SET
          requests=youtube_api_usage_ledger.requests+excluded.requests,
          quota_units=youtube_api_usage_ledger.quota_units+excluded.quota_units,
          updated_at=now()
      `, [input.consumer, input.method, bucket, requests, amount]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

export async function youtubeApiDailyUsage(client: PgClient) {
  await ensureYoutubeApiBudgetTables(client);
  const [breakdown, buckets] = await Promise.all([
    client.query(`SELECT * FROM youtube_api_daily_usage WHERE usage_date=CURRENT_DATE ORDER BY quota_bucket,consumer,method`),
    client.query(`
      SELECT quota_bucket,used,
        CASE quota_bucket WHEN 'general' THEN 10000 WHEN 'search_queries' THEN 100 ELSE 10000 END quota_limit,
        GREATEST(0,CASE quota_bucket WHEN 'general' THEN 10000 WHEN 'search_queries' THEN 100 ELSE 10000 END-used) remaining
      FROM youtube_api_quota_daily WHERE usage_date=CURRENT_DATE ORDER BY quota_bucket
    `),
  ]);
  return { buckets: buckets.rows, consumers: breakdown.rows };
}
