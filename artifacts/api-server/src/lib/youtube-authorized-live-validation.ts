import { pool } from "@workspace/db";
import { logger } from "./logger";
import { bootstrapYoutubeApiUsage, reserveYoutubeApiUsage } from "./youtube-api-budget";
import { safeErrorDetails } from "./safe-error";
import { INNERTUBE_PRIMARY_SOURCE } from "./youtube-discovery-provenance";
import {
  discoverYoutubeMusicArtist,
  type YoutubeMusicDiscoveryAuditCandidate,
} from "./youtube-music-shadow-discovery";
import { YOUTUBE_VALIDATION_AUTO_START } from "./youtube-authorized-live-validation-policy";

const RUN_LOCK = 8_604_260;
const COMPARATOR_RUN_LOCK = 8_604_261;
const CHECK_MS = 6 * 60 * 60 * 1_000;
const COMPARATOR_CHECK_MS = 5 * 60 * 1_000;
const COMPARATOR_ARTISTS_PER_RUN = 5;
const SEARCH_LOGICAL_TARGET = 25;
const SEARCH_REQUEST_HARD_CAP = 40;
const SEARCH_MIN_INTERVAL_MS = 2_500;
const VALIDATION_DAYS = 7;
let started = false;
let lastSearchAttemptAt = 0;

type PgClient = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  release: () => void;
};

type YoutubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: { title?: string; channelId?: string; channelTitle?: string; publishedAt?: string };
  }>;
  error?: { message?: string };
};

type ValidationSession = { id: string; started_at: string; ends_at: string };

function sleep(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function classifyUploader(title: string): string {
  if (/\s-\sTopic$/iu.test(title)) return "topic";
  if (/vevo$/iu.test(title)) return "vevo";
  if (/label|records|music|distrib|distro/iu.test(title)) return "label_shared";
  return "artist_other";
}

function exactLeadingCredit(title: string, artistName: string): boolean {
  const escaped = artistName.trim().split(/\s+/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  return Boolean(escaped) && new RegExp(`^\\s*${escaped}\\s*(?:[-–—:|]|$)`, "iu").test(title);
}

async function ensureTables(client: PgClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_discovery_validation_sessions (
      id bigserial PRIMARY KEY,
      started_at timestamptz NOT NULL DEFAULT now(),
      ends_at timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','complete','stopped')),
      historical_gate jsonb NOT NULL,
      configuration jsonb NOT NULL,
      completed_at timestamptz
    );
    CREATE TABLE IF NOT EXISTS youtube_discovery_validation_channels (
      session_id bigint NOT NULL REFERENCES youtube_discovery_validation_sessions(id) ON DELETE RESTRICT,
      artist_key text NOT NULL,
      artist_name text NOT NULL,
      channel_id text NOT NULL,
      channel_title text,
      uploads_playlist_id text,
      relationship_source text NOT NULL,
      frozen_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (session_id, artist_key, channel_id)
    );
    CREATE TABLE IF NOT EXISTS youtube_discovery_validation_events (
      id bigserial PRIMARY KEY,
      session_id bigint NOT NULL REFERENCES youtube_discovery_validation_sessions(id) ON DELETE RESTRICT,
      source text NOT NULL CHECK (source IN ('authorized_playlist','authorized_search','licensed_signal','innertube_comparator')),
      artist_key text NOT NULL,
      video_id text NOT NULL,
      title text,
      uploader_channel_id text,
      uploader_channel_title text,
      uploader_type text,
      association_status text NOT NULL CHECK (association_status IN ('accepted','protected_review','rejected','comparator')),
      first_seen_at timestamptz NOT NULL DEFAULT now(),
      published_at timestamptz,
      evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (session_id, source, artist_key, video_id)
    );
    CREATE TABLE IF NOT EXISTS youtube_discovery_validation_api_usage (
      session_id bigint NOT NULL REFERENCES youtube_discovery_validation_sessions(id) ON DELETE RESTRICT,
      usage_date date NOT NULL,
      search_logical_calls integer NOT NULL DEFAULT 0,
      search_request_attempts integer NOT NULL DEFAULT 0,
      channel_calls integer NOT NULL DEFAULT 0,
      playlist_calls integer NOT NULL DEFAULT 0,
      video_calls integer NOT NULL DEFAULT 0,
      retries integer NOT NULL DEFAULT 0,
      errors integer NOT NULL DEFAULT 0,
      last_error text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (session_id, usage_date)
    );
    CREATE TABLE IF NOT EXISTS youtube_discovery_validation_daily_snapshots (
      session_id bigint NOT NULL REFERENCES youtube_discovery_validation_sessions(id) ON DELETE RESTRICT,
      validation_day date NOT NULL,
      snapshot_at timestamptz NOT NULL DEFAULT now(),
      metrics jsonb NOT NULL,
      PRIMARY KEY (session_id, validation_day)
    );
    CREATE TABLE IF NOT EXISTS youtube_discovery_validation_comparator_artists (
      session_id bigint NOT NULL REFERENCES youtube_discovery_validation_sessions(id) ON DELETE RESTRICT,
      validation_artist_key text NOT NULL,
      discovery_artist_key text NOT NULL,
      artist_name text NOT NULL,
      baseline_ready_at timestamptz,
      last_attempt_at timestamptz,
      last_success_at timestamptz,
      attempts integer NOT NULL DEFAULT 0,
      successes integer NOT NULL DEFAULT 0,
      candidate_count integer NOT NULL DEFAULT 0,
      last_error text,
      PRIMARY KEY (session_id, validation_artist_key)
    );
    ALTER TABLE youtube_discovery_validation_comparator_artists
      ADD COLUMN IF NOT EXISTS baseline_ready_at timestamptz;
    CREATE TABLE IF NOT EXISTS youtube_discovery_validation_comparator_sightings (
      session_id bigint NOT NULL REFERENCES youtube_discovery_validation_sessions(id) ON DELETE RESTRICT,
      validation_artist_key text NOT NULL,
      discovery_artist_key text NOT NULL,
      video_id text NOT NULL,
      title text,
      first_seen_at timestamptz NOT NULL DEFAULT now(),
      catalog_discovered_at timestamptz NOT NULL,
      evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (session_id, validation_artist_key, video_id)
    );
    CREATE INDEX IF NOT EXISTS youtube_discovery_validation_events_video_idx
      ON youtube_discovery_validation_events(session_id, video_id, first_seen_at);
  `);
  await bootstrapYoutubeApiUsage(client, "validation");
}

async function activeSession(client: PgClient) {
  const existing = await client.query<{ id: string; started_at: string; ends_at: string }>(`
    SELECT id::text, started_at::text, ends_at::text
    FROM youtube_discovery_validation_sessions
    WHERE status='running' ORDER BY id DESC LIMIT 1
  `);
  if (existing.rows[0]) return existing.rows[0];
  return null;
}

async function freezeValidationChannels(client: PgClient, session: ValidationSession) {
  await client.query(`
    INSERT INTO youtube_discovery_validation_channels
      (session_id,artist_key,artist_name,channel_id,channel_title,relationship_source)
    SELECT $1::bigint, yc.artist_key, COALESCE(k.artist_name,yc.title,yc.artist_key), yc.channel_id, yc.title,
           'verified_youtube_channels_at_session_start'
    FROM youtube_channels yc
    LEFT JOIN kworb_coverage k ON k.artist_key=yc.artist_key
    WHERE yc.channel_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `, [session.id]);
  // Freeze only uploader relationships already protected by documented official
  // or trusted-shared-channel evidence. Generic Innertube observations are not
  // promoted into the authorized channel registry.
  await client.query(`
    INSERT INTO youtube_discovery_validation_channels
      (session_id,artist_key,artist_name,channel_id,channel_title,relationship_source)
    SELECT DISTINCT $1::bigint, c.artist_key, c.artist_name, c.evidence->>'uploaderChannelId', NULL,
           'documented_or_verified_relationship_at_session_start'
    FROM youtube_music_catalog_candidates c
    WHERE c.created_at < $2::timestamptz
      AND NULLIF(c.evidence->>'uploaderChannelId','') IS NOT NULL
      AND (
        c.evidence_sources ? 'verified_official_channel_upload'
        OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(c.evidence_sources) value
                   WHERE value LIKE 'trusted\_%' ESCAPE '\\')
      )
    ON CONFLICT DO NOTHING
  `, [session.id, session.started_at]);
}

export async function replaceInvalidYoutubeValidationSession(input: {
  expectedSessionId: string;
  reason: string;
}): Promise<{ stoppedSessionId: string; session: ValidationSession; carriedUsage: { logical: number; attempts: number } }> {
  const client = await pool.connect();
  try {
    await ensureTables(client);
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [RUN_LOCK]);
    const current = await client.query<ValidationSession>(`
      SELECT id::text,started_at::text,ends_at::text
      FROM youtube_discovery_validation_sessions
      WHERE status='running' ORDER BY id DESC LIMIT 1 FOR UPDATE
    `);
    const previous = current.rows[0];
    if (!previous || previous.id !== input.expectedSessionId) {
      throw new Error(`Expected running validation session ${input.expectedSessionId}; found ${previous?.id ?? "none"}.`);
    }
    const coverage = await client.query<{ roster: number; attempted: number; baseline_ready: number; successful: number; failing: number }>(`
      SELECT
        (SELECT count(DISTINCT artist_key)::int FROM youtube_discovery_validation_channels WHERE session_id=$1) roster,
        (SELECT count(*)::int FROM youtube_discovery_validation_comparator_artists WHERE session_id=$1 AND last_attempt_at IS NOT NULL) attempted,
        (SELECT count(*)::int FROM youtube_discovery_validation_comparator_artists WHERE session_id=$1 AND baseline_ready_at IS NOT NULL) baseline_ready,
        (SELECT count(*)::int FROM youtube_discovery_validation_comparator_artists WHERE session_id=$1 AND last_success_at IS NOT NULL) successful,
        (SELECT count(*)::int FROM youtube_discovery_validation_comparator_artists WHERE session_id=$1 AND last_error IS NOT NULL) failing
    `, [previous.id]);
    if ((coverage.rows[0]?.attempted ?? 0) < (coverage.rows[0]?.roster ?? 0)) {
      throw new Error(`Comparator preflight incomplete: ${coverage.rows[0]?.attempted ?? 0}/${coverage.rows[0]?.roster ?? 0} artists attempted.`);
    }
    if ((coverage.rows[0]?.baseline_ready ?? 0) < (coverage.rows[0]?.roster ?? 0)) {
      throw new Error(`Comparator baseline incomplete: ${coverage.rows[0]?.baseline_ready ?? 0}/${coverage.rows[0]?.roster ?? 0} artists ready.`);
    }
    const usage = await client.query<{ logical: number; attempts: number }>(`
      SELECT COALESCE(search_logical_calls,0)::int logical,
             COALESCE(search_request_attempts,0)::int attempts
      FROM youtube_discovery_validation_api_usage
      WHERE session_id=$1 AND usage_date=CURRENT_DATE
    `, [previous.id]);
    const carriedUsage = usage.rows[0] ?? { logical: 0, attempts: 0 };
    await client.query(`UPDATE youtube_discovery_validation_sessions
      SET status='stopped',completed_at=now(),configuration=configuration || jsonb_build_object(
        'decisionWindowUsable',false,'stoppedReason',$2,'stoppedAt',now()
      ) WHERE id=$1`, [previous.id, input.reason]);
    const created = await client.query<ValidationSession>(`
      INSERT INTO youtube_discovery_validation_sessions (ends_at,historical_gate,configuration)
      VALUES (
        now() + interval '${VALIDATION_DAYS} days',
        '{"truthTotal":1536,"found":1493,"coveragePercent":97.20,"holdoutTotal":383,"holdoutFound":373,"holdoutCoveragePercent":97.39}'::jsonb,
        jsonb_build_object(
          'searchLogicalTarget',${SEARCH_LOGICAL_TARGET},
          'searchRequestHardCap',${SEARCH_REQUEST_HARD_CAP},
          'searchMinIntervalMs',${SEARCH_MIN_INTERVAL_MS},
          'innertubeComparatorActive',true,
          'publicWrites',false,
          'decisionWindowUsable',true,
          'comparatorDiscovery','continuous-direct-sightings-v1',
          'preflightSessionId',$1::text,
          'preflightRoster',$4::int,
          'preflightSuccessfulArtists',$5::int,
          'preflightFailingArtists',$6::int,
          'openingConsumedLogicalSearches',$2::int,
          'openingConsumedSearchAttempts',$3::int
        )
      ) RETURNING id::text,started_at::text,ends_at::text
    `, [
      previous.id,
      carriedUsage.logical,
      carriedUsage.attempts,
      coverage.rows[0]?.roster ?? 0,
      coverage.rows[0]?.successful ?? 0,
      coverage.rows[0]?.failing ?? 0,
    ]);
    const session = created.rows[0]!;
    await freezeValidationChannels(client, session);
    if (carriedUsage.logical > 0 || carriedUsage.attempts > 0) {
      await client.query(`INSERT INTO youtube_discovery_validation_api_usage
        (session_id,usage_date,search_logical_calls,search_request_attempts)
        VALUES ($1,CURRENT_DATE,$2,$3)`, [session.id, carriedUsage.logical, carriedUsage.attempts]);
    }
    await client.query("COMMIT");
    logger.info({
      stoppedSessionId: previous.id,
      sessionId: session.id,
      startsAt: session.started_at,
      endsAt: session.ends_at,
      carriedLogicalSearches: carriedUsage.logical,
      carriedSearchAttempts: carriedUsage.attempts,
    }, "[youtube-authorized-validation] clean decision window started");
    return { stoppedSessionId: previous.id, session, carriedUsage };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function addUsage(client: PgClient, sessionId: string, column: string, amount = 1, error?: string) {
  const allowed = new Set(["search_logical_calls","search_request_attempts","channel_calls","playlist_calls","video_calls","retries","errors"]);
  if (!allowed.has(column)) throw new Error(`Unsupported usage column ${column}`);
  await client.query(`
    INSERT INTO youtube_discovery_validation_api_usage (session_id,usage_date,${column},last_error)
    VALUES ($1,CURRENT_DATE,$2,$3)
    ON CONFLICT (session_id,usage_date) DO UPDATE SET
      ${column}=youtube_discovery_validation_api_usage.${column}+$2,
      last_error=COALESCE($3,youtube_discovery_validation_api_usage.last_error), updated_at=now()
  `, [sessionId, amount, error?.slice(0, 500) ?? null]);
}

async function youtubeJson<T>(client: PgClient, sessionId: string, resource: string, params: Record<string,string>, usageColumn: string): Promise<T> {
  const apiKey = process.env["YOUTUBE_API_KEY"];
  if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY.");
  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
  url.searchParams.set("key", apiKey);
  Object.entries(params).forEach(([key,value]) => url.searchParams.set(key,value));
  await reserveYoutubeApiUsage(client, {
    consumer: "protected_validation",
    method: resource === "channels" ? "channels.list" : resource === "playlistItems" ? "playlistItems.list" : `${resource}.list`,
  });
  await addUsage(client, sessionId, usageColumn);
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const text = await response.text();
  if (!response.ok) {
    await addUsage(client, sessionId, "errors", 1, `${resource} ${response.status}: ${text}`);
    throw new Error(`YouTube Data API ${resource} ${response.status}: ${text.slice(0,300)}`);
  }
  return JSON.parse(text) as T;
}

async function hydrateUploadsPlaylists(client: PgClient, sessionId: string) {
  const missing = await client.query<{ channel_id: string }>(`
    SELECT DISTINCT channel_id FROM youtube_discovery_validation_channels
    WHERE session_id=$1 AND uploads_playlist_id IS NULL LIMIT 5000
  `, [sessionId]);
  for (let index=0; index<missing.rows.length; index+=50) {
    const ids = missing.rows.slice(index,index+50).map(row=>row.channel_id);
    const response = await youtubeJson<{ items?: Array<{ id:string; snippet?:{title?:string}; contentDetails?:{relatedPlaylists?:{uploads?:string}} }> }>(
      client,sessionId,"channels",{part:"snippet,contentDetails",id:ids.join(","),maxResults:String(ids.length)},"channel_calls",
    );
    for (const item of response.items ?? []) {
      await client.query(`UPDATE youtube_discovery_validation_channels
        SET uploads_playlist_id=$3, channel_title=COALESCE($4,channel_title)
        WHERE session_id=$1 AND channel_id=$2`,
      [sessionId,item.id,item.contentDetails?.relatedPlaylists?.uploads ?? null,item.snippet?.title ?? null]);
    }
  }
}

async function scanAuthorizedChannels(client: PgClient, sessionId: string) {
  const channels = await client.query<{artist_key:string;artist_name:string;channel_id:string;channel_title:string|null;uploads_playlist_id:string;relationship_source:string}>(`
    SELECT artist_key,artist_name,channel_id,channel_title,uploads_playlist_id,relationship_source
    FROM youtube_discovery_validation_channels WHERE session_id=$1 AND uploads_playlist_id IS NOT NULL
    ORDER BY artist_key,channel_id
  `,[sessionId]);
  for (const channel of channels.rows) {
    try {
      const page = await youtubeJson<{items?:Array<{snippet?:{title?:string;publishedAt?:string;channelTitle?:string};contentDetails?:{videoId?:string}}>}>(
        client,sessionId,"playlistItems",{part:"snippet,contentDetails",playlistId:channel.uploads_playlist_id,maxResults:"50"},"playlist_calls",
      );
      for (const item of page.items ?? []) {
        const videoId=item.contentDetails?.videoId;
        const publishedAt=item.snippet?.publishedAt;
        if (!videoId || !publishedAt) continue;
        const title=item.snippet?.title ?? "";
        const shared = !channel.relationship_source.startsWith("verified_youtube_channels");
        const accepted = !shared || exactLeadingCredit(title,channel.artist_name);
        await client.query(`INSERT INTO youtube_discovery_validation_events
          (session_id,source,artist_key,video_id,title,uploader_channel_id,uploader_channel_title,uploader_type,association_status,published_at,evidence)
          SELECT $1::bigint,'authorized_playlist',$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb
          WHERE $9::timestamptz >= (SELECT started_at-interval '1 day' FROM youtube_discovery_validation_sessions WHERE id=$1)
          ON CONFLICT DO NOTHING`,[
          sessionId,channel.artist_key,videoId,title,channel.channel_id,item.snippet?.channelTitle ?? channel.channel_title,
          classifyUploader(item.snippet?.channelTitle ?? channel.channel_title ?? ""),accepted?"accepted":"protected_review",publishedAt,
          JSON.stringify({relationshipSource:channel.relationship_source,exactLeadingCredit:accepted}),
        ]);
      }
    } catch (error) {
      logger.warn(safeErrorDetails(error,{channelId:channel.channel_id,job:"authorized-playlist-scan"}),"[youtube-authorized-validation] playlist scan failed");
    }
  }
}

async function reserveSearchLogicalCall(client: PgClient, sessionId: string): Promise<boolean> {
  const result = await client.query<{search_logical_calls:number;search_request_attempts:number}>(`
    INSERT INTO youtube_discovery_validation_api_usage (session_id,usage_date,search_logical_calls)
    VALUES ($1,CURRENT_DATE,1)
    ON CONFLICT (session_id,usage_date) DO UPDATE SET
      search_logical_calls=youtube_discovery_validation_api_usage.search_logical_calls+1, updated_at=now()
    WHERE youtube_discovery_validation_api_usage.search_logical_calls < ${SEARCH_LOGICAL_TARGET}
      AND youtube_discovery_validation_api_usage.search_request_attempts < ${SEARCH_REQUEST_HARD_CAP}
    RETURNING search_logical_calls,search_request_attempts
  `,[sessionId]);
  return Boolean(result.rows[0]);
}

async function reserveSearchAttempt(client: PgClient, sessionId: string): Promise<boolean> {
  const result=await client.query(`UPDATE youtube_discovery_validation_api_usage
    SET search_request_attempts=search_request_attempts+1,updated_at=now()
    WHERE session_id=$1 AND usage_date=CURRENT_DATE AND search_request_attempts < ${SEARCH_REQUEST_HARD_CAP}
    RETURNING search_request_attempts`,[sessionId]);
  return Boolean(result.rows[0]);
}

async function documentedSearch(client: PgClient, sessionId: string, query: string, publishedAfter: string): Promise<YoutubeSearchResponse> {
  if (!await reserveSearchLogicalCall(client,sessionId)) throw new Error("Daily logical search target or request ceiling reached.");
  let attempt=0;
  for (;;) {
    if (!await reserveSearchAttempt(client,sessionId)) throw new Error("Search request hard cap reached (40/day including retries).");
    const pacing=Math.max(0,lastSearchAttemptAt+SEARCH_MIN_INTERVAL_MS-Date.now());
    if (pacing) await sleep(pacing);
    lastSearchAttemptAt=Date.now();
    const apiKey=process.env["YOUTUBE_API_KEY"];
    if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY.");
    const url=new URL("https://www.googleapis.com/youtube/v3/search");
    Object.entries({key:apiKey,part:"snippet",type:"video",q:query,order:"date",publishedAfter,maxResults:"50",regionCode:"MX"})
      .forEach(([key,value])=>url.searchParams.set(key,value));
    await reserveYoutubeApiUsage(client, { consumer: "protected_validation_search", method: "search.list" });
    const response=await fetch(url,{signal:AbortSignal.timeout(15_000)});
    const text=await response.text();
    if (response.ok) return JSON.parse(text) as YoutubeSearchResponse;
    if (response.status===429 && /quota exceeded[\s\S]*per day/i.test(text)) {
      await addUsage(client,sessionId,"errors",1,`search ${response.status}: ${text}`);
      await client.query(`UPDATE youtube_discovery_validation_api_usage
        SET search_request_attempts=${SEARCH_REQUEST_HARD_CAP},updated_at=now()
        WHERE session_id=$1 AND usage_date=CURRENT_DATE`,[sessionId]);
      throw new Error("Daily Search Queries quota exhausted; protected search stopped until the next quota day.");
    }
    if (response.status!==429 || attempt>=2) {
      await addUsage(client,sessionId,"errors",1,`search ${response.status}: ${text}`);
      throw new Error(`YouTube search ${response.status}: ${text.slice(0,300)}`);
    }
    attempt+=1;
    await addUsage(client,sessionId,"retries");
    await sleep(2_000*(2**(attempt-1)));
  }
}

async function runPrioritizedSearches(client: PgClient, session:{id:string;started_at:string}) {
  const remaining=await client.query<{remaining:number}>(`
    SELECT GREATEST(0,${SEARCH_LOGICAL_TARGET}-COALESCE((SELECT search_logical_calls FROM youtube_discovery_validation_api_usage
      WHERE session_id=$1 AND usage_date=CURRENT_DATE),0))::int remaining`,[session.id]);
  const perPass=Math.min(7,remaining.rows[0]?.remaining ?? 0);
  if (!perPass) return;
  const artists=await client.query<{artist_key:string;artist_name:string;release_title:string|null}>(`
    SELECT k.artist_key,k.artist_name,
      NULLIF(s.catalog #>> '{tracks,0,title}','') release_title
    FROM kworb_coverage k
    LEFT JOIN songstats_artist_extended_data s ON s.artist_key=k.artist_key
    WHERE k.status='active'
    ORDER BY
      CASE WHEN s.catalog_fetched_at >= now()-interval '14 days' THEN 0 ELSE 1 END,
      COALESCE(s.catalog_fetched_at,'epoch') DESC,k.artist_key
    LIMIT $1
  `,[perPass]);
  for (const artist of artists.rows) {
    try {
      const query=artist.release_title?`${artist.artist_name} ${artist.release_title}`:artist.artist_name;
      const result=await documentedSearch(client,session.id,query,new Date(session.started_at).toISOString());
      for (const item of result.items ?? []) {
        const videoId=item.id?.videoId;
        if (!videoId) continue;
        const title=item.snippet?.title ?? "";
        const accepted=exactLeadingCredit(title,artist.artist_name);
        await client.query(`INSERT INTO youtube_discovery_validation_events
          (session_id,source,artist_key,video_id,title,uploader_channel_id,uploader_channel_title,uploader_type,association_status,published_at,evidence)
          VALUES ($1,'authorized_search',$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) ON CONFLICT DO NOTHING`,[
          session.id,artist.artist_key,videoId,title,item.snippet?.channelId ?? null,item.snippet?.channelTitle ?? null,
          classifyUploader(item.snippet?.channelTitle ?? ""),accepted?"accepted":"protected_review",item.snippet?.publishedAt ?? null,
          JSON.stringify({queryBasis:artist.release_title?"recent_licensed_release":"recent_active_artist",exactLeadingCredit:accepted}),
        ]);
      }
    } catch(error) {
      logger.warn(safeErrorDetails(error,{artistKey:artist.artist_key,job:"documented-search"}),"[youtube-authorized-validation] documented search failed");
      if (/target|hard cap/i.test(String(error))) break;
    }
  }
}

async function ensureComparatorRoster(client: PgClient, sessionId: string) {
  await client.query(`WITH frozen AS (
      SELECT artist_key,min(artist_name) artist_name,
        regexp_replace(translate(lower(artist_key),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g') normalized_artist_key
      FROM youtube_discovery_validation_channels
      WHERE session_id=$1
      GROUP BY artist_key
    ), canonical AS (
      SELECT DISTINCT ON (normalized_artist_key)
        normalized_artist_key,artist_key,artist_name
      FROM (
        SELECT artist_key,artist_name,status,
          regexp_replace(translate(lower(artist_key),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g') normalized_artist_key
        FROM kworb_coverage
      ) candidates
      ORDER BY normalized_artist_key,CASE WHEN status='active' THEN 0 ELSE 1 END,artist_key
    ), baseline AS (
      SELECT DISTINCT
        regexp_replace(translate(lower(artist_key),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g') normalized_artist_key
      FROM youtube_music_catalog_candidates
      WHERE evidence_source=$2
    )
    INSERT INTO youtube_discovery_validation_comparator_artists
    (session_id,validation_artist_key,discovery_artist_key,artist_name,baseline_ready_at)
    SELECT $1::bigint, frozen.artist_key,
      COALESCE(canonical.artist_key,frozen.artist_key),
      COALESCE(canonical.artist_name,frozen.artist_name),
      CASE WHEN baseline.normalized_artist_key IS NOT NULL THEN now() ELSE NULL END
    FROM frozen
    LEFT JOIN canonical ON canonical.normalized_artist_key=frozen.normalized_artist_key
    LEFT JOIN baseline ON baseline.normalized_artist_key=
      regexp_replace(translate(lower(COALESCE(canonical.artist_key,frozen.artist_key)),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g')
    ON CONFLICT (session_id,validation_artist_key) DO UPDATE SET
      discovery_artist_key=excluded.discovery_artist_key,
      artist_name=excluded.artist_name,
      baseline_ready_at=COALESCE(youtube_discovery_validation_comparator_artists.baseline_ready_at,excluded.baseline_ready_at)`,
  [sessionId, INNERTUBE_PRIMARY_SOURCE]);
}

async function comparatorBrowseId(client: PgClient, discoveryArtistKey: string): Promise<string | null> {
  const result = await client.query<{ browse_id: string }>(`
    SELECT browse_id
    FROM youtube_music_artist_candidates
    WHERE regexp_replace(translate(lower(artist_key),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g')
        = regexp_replace(translate(lower($1),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g')
      AND evidence_source=$2
      AND status IN ('verified','review')
    ORDER BY CASE WHEN status='verified' THEN 0 ELSE 1 END,last_checked_at DESC NULLS LAST,id DESC
    LIMIT 1
  `, [discoveryArtistKey, INNERTUBE_PRIMARY_SOURCE]);
  return result.rows[0]?.browse_id ?? null;
}

async function comparatorTrustedBrowseIds(
  client: PgClient,
  sessionId: string,
  validationArtistKey: string,
): Promise<string[]> {
  const result = await client.query<{ channel_id: string }>(`
    SELECT DISTINCT channel_id
    FROM youtube_discovery_validation_channels
    WHERE session_id=$1 AND artist_key=$2 AND NULLIF(channel_id,'') IS NOT NULL
    ORDER BY channel_id
  `, [sessionId, validationArtistKey]);
  return result.rows.map(row => row.channel_id);
}

async function recordComparatorSightings(input: {
  client: PgClient;
  session: ValidationSession;
  validationArtistKey: string;
  discoveryArtistKey: string;
  candidates: YoutubeMusicDiscoveryAuditCandidate[];
}) {
  if (!input.candidates.length) return 0;
  const candidateJson = JSON.stringify(input.candidates.map(candidate => ({
    videoId: candidate.videoId,
    title: candidate.title,
    sourceSections: candidate.sourceSections,
    releaseIds: candidate.releaseIds,
    status: candidate.status,
    confidence: candidate.confidence,
  })));
  const inserted = await input.client.query<{ video_id: string }>(`
    WITH observed AS (
      SELECT * FROM jsonb_to_recordset($5::jsonb) AS candidate(
        "videoId" text,"title" text,"sourceSections" jsonb,"releaseIds" jsonb,"status" text,"confidence" integer
      )
    ), eligible AS (
      SELECT candidate.*,catalog.discovered_at
      FROM observed candidate
      JOIN youtube_music_catalog_candidates catalog
        ON catalog.artist_key=$4 AND catalog.video_id=candidate."videoId"
      WHERE catalog.discovered_at >= $2::timestamptz
    )
    INSERT INTO youtube_discovery_validation_comparator_sightings
      (session_id,validation_artist_key,discovery_artist_key,video_id,title,catalog_discovered_at,evidence)
    SELECT $1::bigint,$3,$4,eligible."videoId",eligible."title",eligible.discovered_at,
      jsonb_build_object(
        'primarySource',$6::text,
        'sourceSections',eligible."sourceSections",
        'releaseIds',eligible."releaseIds",
        'candidateStatus',eligible."status",
        'confidence',eligible."confidence",
        'provenanceClassifier','direct-innertube-sighting-v1'
      )
    FROM eligible
    ON CONFLICT DO NOTHING
    RETURNING video_id
  `, [
    input.session.id,
    input.session.started_at,
    input.validationArtistKey,
    input.discoveryArtistKey,
    candidateJson,
    INNERTUBE_PRIMARY_SOURCE,
  ]);
  return inserted.rows.length;
}

async function runComparatorArtist(input: {
  client: PgClient;
  session: ValidationSession;
  validationArtistKey: string;
  discoveryArtistKey: string;
  artistName: string;
}) {
  await input.client.query(`UPDATE youtube_discovery_validation_comparator_artists
    SET last_attempt_at=now(),attempts=attempts+1,last_error=NULL
    WHERE session_id=$1 AND validation_artist_key=$2`, [input.session.id, input.validationArtistKey]);
  try {
    const browseId = await comparatorBrowseId(input.client, input.discoveryArtistKey);
    const trustedBrowseIds = browseId
      ? []
      : await comparatorTrustedBrowseIds(
          input.client,
          input.session.id,
          input.validationArtistKey,
        );
    const summary = await discoverYoutubeMusicArtist({
      artistKey: input.discoveryArtistKey,
      artistName: input.artistName,
      browseId,
      trustedBrowseId: false,
      trustedBrowseIds,
      write: true,
      includeCandidates: true,
    });
    if (!["review","verified"].includes(summary.mappingStatus)) {
      throw new Error(summary.error ?? `Comparator mapping ended with status ${summary.mappingStatus}.`);
    }
    const candidates = summary.candidates ?? [];
    const sightings = await recordComparatorSightings({ ...input, candidates });
    await input.client.query(`UPDATE youtube_discovery_validation_comparator_artists
      SET baseline_ready_at=COALESCE(baseline_ready_at,now()),last_success_at=now(),successes=successes+1,candidate_count=$3,last_error=NULL
      WHERE session_id=$1 AND validation_artist_key=$2`, [input.session.id, input.validationArtistKey, candidates.length]);
    return { status: "complete" as const, candidates: candidates.length, sightings };
  } catch (error) {
    const details = safeErrorDetails(error, {
      sessionId: input.session.id,
      validationArtistKey: input.validationArtistKey,
      discoveryArtistKey: input.discoveryArtistKey,
      job: "validation-innertube-comparator",
    });
    const safeError = details.error as { name?: string; message?: string };
    await input.client.query(`UPDATE youtube_discovery_validation_comparator_artists
      SET last_error=$3
      WHERE session_id=$1 AND validation_artist_key=$2`, [
      input.session.id,
      input.validationArtistKey,
      `${safeError.name ?? "ComparatorError"}: ${safeError.message ?? "Comparator discovery failed"}`.slice(0, 500),
    ]);
    logger.warn(details, "[youtube-authorized-validation] comparator artist failed");
    return { status: "failed" as const, candidates: 0, sightings: 0 };
  }
}

async function captureComparator(client: PgClient, session:{id:string;started_at:string}) {
  await client.query(`INSERT INTO youtube_discovery_validation_events
    (session_id,source,artist_key,video_id,title,uploader_channel_id,uploader_channel_title,uploader_type,association_status,first_seen_at,published_at,evidence)
    SELECT $1::bigint,'innertube_comparator',s.validation_artist_key,s.video_id,s.title,
      NULL,NULL,
      CASE WHEN s.evidence::text ILIKE '%topic%' THEN 'topic' ELSE 'artist_other' END,
      'comparator',s.first_seen_at,v.published_at,s.evidence
    FROM youtube_discovery_validation_comparator_sightings s
    JOIN youtube_tracked_videos v ON v.video_id=s.video_id
    WHERE s.session_id=$1
      AND v.published_at >= $2::timestamptz - interval '1 day'
    ON CONFLICT DO NOTHING`,[session.id,session.started_at]);
  await client.query(`UPDATE youtube_discovery_validation_sessions
    SET configuration=configuration || jsonb_build_object(
      'provenanceClassifier','direct-innertube-sighting-v1',
      'lastComparatorCaptureAt',now()
    ) WHERE id=$1`,[session.id]);
}

export async function runYoutubeValidationComparatorSweep(
  reason = "scheduled",
  limit = COMPARATOR_ARTISTS_PER_RUN,
) {
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const locked = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) locked", [COMPARATOR_RUN_LOCK]);
    if (!locked.rows[0]?.locked) return { status: "skipped", reason: "already-running" };
    try {
      const session = await activeSession(client);
      if (!session) return { status: "idle", reason: "no-running-session" };
      if (new Date(session.ends_at) <= new Date()) return { status: "idle", reason: "session-ended", sessionId: session.id };
      await ensureComparatorRoster(client, session.id);
      const batch = await client.query<{
        validation_artist_key: string;
        discovery_artist_key: string;
        artist_name: string;
      }>(`SELECT validation_artist_key,discovery_artist_key,artist_name
          FROM youtube_discovery_validation_comparator_artists
          WHERE session_id=$1
          ORDER BY
            CASE WHEN baseline_ready_at IS NULL THEN 0 ELSE 1 END,
            last_attempt_at ASC NULLS FIRST,
            validation_artist_key
          LIMIT $2`, [session.id, Math.max(1, Math.min(100, Math.floor(limit)))]);
      let succeeded = 0;
      let failed = 0;
      let candidates = 0;
      let sightings = 0;
      for (const artist of batch.rows) {
        const result = await runComparatorArtist({
          client,
          session,
          validationArtistKey: artist.validation_artist_key,
          discoveryArtistKey: artist.discovery_artist_key,
          artistName: artist.artist_name,
        });
        if (result.status === "complete") succeeded += 1;
        else failed += 1;
        candidates += result.candidates;
        sightings += result.sightings;
      }
      await captureComparator(client, session);
      const progress = await client.query<{ roster: number; attempted: number; baseline_ready: number; successful: number; failed: number }>(`
        SELECT count(*)::int roster,
          count(*) FILTER (WHERE last_attempt_at IS NOT NULL)::int attempted,
          count(*) FILTER (WHERE baseline_ready_at IS NOT NULL)::int baseline_ready,
          count(*) FILTER (WHERE last_success_at IS NOT NULL)::int successful,
          count(*) FILTER (WHERE last_error IS NOT NULL)::int failed
        FROM youtube_discovery_validation_comparator_artists WHERE session_id=$1
      `, [session.id]);
      return {
        status: "running",
        reason,
        sessionId: session.id,
        processed: batch.rows.length,
        succeeded,
        failed,
        candidates,
        sightings,
        progress: progress.rows[0],
      };
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [COMPARATOR_RUN_LOCK]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

async function snapshotDay(client: PgClient, sessionId: string) {
  await client.query(`INSERT INTO youtube_discovery_validation_daily_snapshots(session_id,validation_day,metrics)
    SELECT $1::bigint,CURRENT_DATE,jsonb_build_object(
      'authorizedDiscoveries',count(DISTINCT video_id) FILTER (WHERE source LIKE 'authorized_%' AND association_status IN ('accepted','protected_review')),
      'authorizedAccepted',count(DISTINCT video_id) FILTER (WHERE source LIKE 'authorized_%' AND association_status='accepted'),
      'innertubeDiscoveries',count(DISTINCT video_id) FILTER (WHERE source='innertube_comparator'),
      'overlap',count(DISTINCT video_id) FILTER (WHERE video_id IN (SELECT video_id FROM youtube_discovery_validation_events WHERE session_id=$1 AND source LIKE 'authorized_%') AND source='innertube_comparator'),
      'authorizedMisses',count(DISTINCT video_id) FILTER (WHERE source='innertube_comparator' AND video_id NOT IN (SELECT video_id FROM youtube_discovery_validation_events WHERE session_id=$1 AND source LIKE 'authorized_%')),
      'topicCandidates',count(DISTINCT video_id) FILTER (WHERE uploader_type='topic' AND source LIKE 'authorized_%'),
      'vevoCandidates',count(DISTINCT video_id) FILTER (WHERE uploader_type='vevo' AND source LIKE 'authorized_%'),
      'labelSharedCandidates',count(DISTINCT video_id) FILTER (WHERE uploader_type='label_shared' AND source LIKE 'authorized_%'),
      'artistOtherCandidates',count(DISTINCT video_id) FILTER (WHERE uploader_type='artist_other' AND source LIKE 'authorized_%'),
      'collaborationCandidates',count(DISTINCT video_id) FILTER (WHERE source LIKE 'authorized_%' AND evidence->>'relationshipSource' ILIKE '%collaborat%'),
      'releaseTrackCandidates',count(DISTINCT video_id) FILTER (WHERE source LIKE 'authorized_%' AND evidence->>'queryBasis'='recent_licensed_release'),
      'protectedReview',count(*) FILTER (WHERE association_status='protected_review'),
      'falseAssociations',count(*) FILTER (WHERE association_status='rejected'),
      'comparatorRoster',COALESCE((SELECT count(*) FROM youtube_discovery_validation_comparator_artists WHERE session_id=$1),0),
      'comparatorArtistsAttempted',COALESCE((SELECT count(*) FROM youtube_discovery_validation_comparator_artists WHERE session_id=$1 AND last_attempt_at IS NOT NULL),0),
      'comparatorBaselinesReady',COALESCE((SELECT count(*) FROM youtube_discovery_validation_comparator_artists WHERE session_id=$1 AND baseline_ready_at IS NOT NULL),0),
      'comparatorArtistsSuccessful',COALESCE((SELECT count(*) FROM youtube_discovery_validation_comparator_artists WHERE session_id=$1 AND last_success_at IS NOT NULL),0),
      'comparatorArtistsFailing',COALESCE((SELECT count(*) FROM youtube_discovery_validation_comparator_artists WHERE session_id=$1 AND last_error IS NOT NULL),0),
      'comparatorLastAttemptAt',(SELECT max(last_attempt_at) FROM youtube_discovery_validation_comparator_artists WHERE session_id=$1),
      'comparatorLastSuccessAt',(SELECT max(last_success_at) FROM youtube_discovery_validation_comparator_artists WHERE session_id=$1),
      'averageAuthorizedMinusComparatorSeconds',(
        SELECT avg(EXTRACT(EPOCH FROM (authorized.first_seen_at-comparator.first_seen_at)))
        FROM youtube_discovery_validation_events authorized
        JOIN youtube_discovery_validation_events comparator
          ON comparator.session_id=authorized.session_id AND comparator.video_id=authorized.video_id
         AND comparator.source='innertube_comparator'
        WHERE authorized.session_id=$1 AND authorized.source LIKE 'authorized_%'
      ),
      'searchUsage',COALESCE((SELECT to_jsonb(u) FROM youtube_discovery_validation_api_usage u WHERE u.session_id=$1 AND u.usage_date=CURRENT_DATE),'{}'::jsonb)
    ) FROM youtube_discovery_validation_events WHERE session_id=$1
    ON CONFLICT (session_id,validation_day) DO UPDATE SET metrics=excluded.metrics,snapshot_at=now()`,[sessionId]);
}

export async function runYoutubeAuthorizedLiveValidation(reason="scheduled") {
  const client=await pool.connect();
  try {
    await ensureTables(client);
    const locked=await client.query<{locked:boolean}>("SELECT pg_try_advisory_lock($1) locked",[RUN_LOCK]);
    if (!locked.rows[0]?.locked) return {status:"skipped",reason:"already-running"};
    try {
      const session=await activeSession(client);
      if (!session) return {status:"idle",reason:"no-running-session",autoStart:YOUTUBE_VALIDATION_AUTO_START};
      if (new Date(session.ends_at)<=new Date()) {
        await captureComparator(client,session);
        await snapshotDay(client,session.id);
        await client.query("UPDATE youtube_discovery_validation_sessions SET status='complete',completed_at=now() WHERE id=$1",[session.id]);
        return {status:"complete",sessionId:session.id};
      }
      // Promote any direct comparator sightings whose publication metadata is
      // now available before slower documented-API scans begin.
      await captureComparator(client,session);
      await snapshotDay(client,session.id);
      await hydrateUploadsPlaylists(client,session.id);
      await scanAuthorizedChannels(client,session.id);
      await runPrioritizedSearches(client,session);
      await captureComparator(client,session);
      await snapshotDay(client,session.id);
      return {status:"running",sessionId:session.id,reason,endsAt:session.ends_at};
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)",[RUN_LOCK]).catch(()=>{});
    }
  } finally { client.release(); }
}

export function startYoutubeAuthorizedLiveValidation() {
  if (started) return;
  started=true;
  const run=(reason:string)=>void runYoutubeAuthorizedLiveValidation(reason)
    .then(result=>logger.info(result,"[youtube-authorized-validation] run complete"))
    .catch(error=>logger.error(safeErrorDetails(error,{job:"protected-live-validation"}),"[youtube-authorized-validation] run failed"));
  setTimeout(()=>run("startup"),15_000).unref();
  setInterval(()=>run("six-hour-check"),CHECK_MS).unref();
  const runComparator=(reason:string)=>void runYoutubeValidationComparatorSweep(reason)
    .then(result=>logger.info(result,"[youtube-authorized-validation] comparator sweep complete"))
    .catch(error=>logger.error(safeErrorDetails(error,{job:"protected-live-validation-comparator"}),"[youtube-authorized-validation] comparator sweep failed"));
  setTimeout(()=>runComparator("startup"),45_000).unref();
  setInterval(()=>runComparator("five-minute-comparator"),COMPARATOR_CHECK_MS).unref();
  logger.info({
    days:VALIDATION_DAYS,
    searchTarget:SEARCH_LOGICAL_TARGET,
    searchHardCap:SEARCH_REQUEST_HARD_CAP,
    autoStart:YOUTUBE_VALIDATION_AUTO_START,
    comparatorIntervalMs:COMPARATOR_CHECK_MS,
    comparatorArtistsPerRun:COMPARATOR_ARTISTS_PER_RUN,
  },"[youtube-authorized-validation] protected validation enabled");
}
