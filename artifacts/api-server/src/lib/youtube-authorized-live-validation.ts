import { youtubeValidationPool } from "@workspace/db";
import { logger } from "./logger";
import { bootstrapYoutubeApiUsage, reserveYoutubeApiUsage } from "./youtube-api-budget";
import { safeErrorDetails } from "./safe-error";
import { INNERTUBE_PRIMARY_SOURCE } from "./youtube-discovery-provenance";
import { connectWithBoundedRetry } from "./youtube-validation-connection";
import {
  readSafeDatabaseRuntimeIdentity,
  youtubeValidationRunLogLevel,
} from "./youtube-runtime-observability";

const RUN_LOCK = 8_604_260;
const CHECK_MS = 6 * 60 * 60 * 1_000;
const SEARCH_LOGICAL_TARGET = 25;
const SEARCH_REQUEST_HARD_CAP = 40;
const SEARCH_MIN_INTERVAL_MS = 2_500;
const VALIDATION_DAYS = 7;
const VALIDATION_CONNECTION_ATTEMPTS = 3;
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
  const created = await client.query<{ id: string; started_at: string; ends_at: string }>(`
    INSERT INTO youtube_discovery_validation_sessions (ends_at,historical_gate,configuration)
    VALUES (
      now() + interval '${VALIDATION_DAYS} days',
      '{"truthTotal":1536,"found":1493,"coveragePercent":97.20,"holdoutTotal":383,"holdoutFound":373,"holdoutCoveragePercent":97.39}'::jsonb,
      '{"searchLogicalTarget":25,"searchRequestHardCap":40,"searchMinIntervalMs":2500,"innertubeComparatorActive":true,"publicWrites":false}'::jsonb
    ) RETURNING id::text, started_at::text, ends_at::text
  `);
  const session = created.rows[0]!;
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
  logger.info({ sessionId: session.id, endsAt: session.ends_at }, "[youtube-authorized-validation] seven-day session started");
  return session;
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

async function captureComparator(client: PgClient, session:{id:string;started_at:string}) {
  // Existing comparator rows are decision-window accounting, not historical
  // observations. Rebuild them from immutable catalog provenance so a prior
  // classifier bug cannot survive alongside corrected rows.
  await client.query(`DELETE FROM youtube_discovery_validation_events
    WHERE session_id=$1 AND source='innertube_comparator'`,[session.id]);
  await client.query(`INSERT INTO youtube_discovery_validation_events
    (session_id,source,artist_key,video_id,title,uploader_channel_id,uploader_channel_title,uploader_type,association_status,first_seen_at,published_at,evidence)
    SELECT $1::bigint,'innertube_comparator',c.artist_key,c.video_id,c.title,c.evidence->>'uploaderChannelId',NULL,
      CASE WHEN c.evidence_sources::text ILIKE '%topic%' THEN 'topic' ELSE 'artist_other' END,
      'comparator',COALESCE(c.discovered_at,c.created_at),v.published_at,
      jsonb_build_object(
        'primarySource',c.evidence_source,
        'evidenceSources',c.evidence_sources,
        'candidateStatus',c.status,
        'provenanceClassifier','explicit-primary-v1'
      )
    FROM youtube_music_catalog_candidates c
    JOIN youtube_tracked_videos v ON v.video_id=c.video_id
    WHERE COALESCE(c.discovered_at,c.created_at) >= $2::timestamptz
      AND v.published_at >= $2::timestamptz - interval '1 day'
      AND c.evidence_source=$3
    ON CONFLICT DO NOTHING`,[session.id,session.started_at,INNERTUBE_PRIMARY_SOURCE]);
  await client.query(`UPDATE youtube_discovery_validation_sessions
    SET configuration=configuration || jsonb_build_object(
      'provenanceClassifier','explicit-primary-v1',
      'provenanceReclassifiedAt',now()
    ) WHERE id=$1`,[session.id]);
}

async function snapshotDay(client: PgClient, sessionId: string) {
  const result = await client.query<{ snapshot_at: string; metrics: Record<string, unknown> }>(`INSERT INTO youtube_discovery_validation_daily_snapshots(session_id,validation_day,metrics)
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
    ON CONFLICT (session_id,validation_day) DO UPDATE SET metrics=excluded.metrics,snapshot_at=now()
    RETURNING snapshot_at::text, metrics`,[sessionId]);
  return result.rows[0]!;
}

export async function runYoutubeAuthorizedLiveValidation(reason="scheduled") {
  const client=await connectWithBoundedRetry({
    connect:()=>youtubeValidationPool.connect(),
    maxAttempts:VALIDATION_CONNECTION_ATTEMPTS,
    retryDelayMs:attempt=>attempt*5_000,
    onFailedAttempt:({attempt,durationMs,error,maxAttempts,retryDelayMs})=>{
      logger.warn({
        event:"youtube_protected_validation_connection_attempt",
        job:"protected-live-validation",
        phase:"database-connect",
        attempt,
        maxAttempts,
        durationMs,
        retryDelayMs,
        retrying:retryDelayMs!==null,
        ...safeErrorDetails(error),
      },`[youtube-authorized-validation] database connection attempt ${attempt}/${maxAttempts} failed; retrying=${retryDelayMs!==null}`);
    },
  });
  try {
    const databaseTarget=await readSafeDatabaseRuntimeIdentity(client);
    await ensureTables(client);
    const locked=await client.query<{locked:boolean}>("SELECT pg_try_advisory_lock($1) locked",[RUN_LOCK]);
    if (!locked.rows[0]?.locked) return {status:"skipped" as const,reason:"already-running",databaseTarget};
    try {
      const session=await activeSession(client);
      if (new Date(session.ends_at)<=new Date()) {
        await captureComparator(client,session);
        const snapshot=await snapshotDay(client,session.id);
        await client.query("UPDATE youtube_discovery_validation_sessions SET status='complete',completed_at=now() WHERE id=$1",[session.id]);
        return {status:"complete" as const,sessionId:session.id,snapshot,databaseTarget};
      }
      // Rebuild decision-window comparator accounting from explicit immutable
      // provenance before slower API scans. A long channel backlog must not
      // leave known-invalid legacy comparator counts visible for the run.
      await captureComparator(client,session);
      await snapshotDay(client,session.id);
      await hydrateUploadsPlaylists(client,session.id);
      await scanAuthorizedChannels(client,session.id);
      await runPrioritizedSearches(client,session);
      await captureComparator(client,session);
      const snapshot=await snapshotDay(client,session.id);
      return {status:"running" as const,sessionId:session.id,reason,endsAt:session.ends_at,snapshot,databaseTarget};
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)",[RUN_LOCK]).catch(()=>{});
    }
  } finally { client.release(); }
}

export function startYoutubeAuthorizedLiveValidation() {
  if (started) return;
  started=true;
  const run=(reason:string)=>void runYoutubeAuthorizedLiveValidation(reason)
    .then(result=>{
      const level=youtubeValidationRunLogLevel(result.status);
      const metrics="snapshot" in result ? result.snapshot?.metrics ?? {} : {};
      logger[level]({event:"youtube_protected_validation_cycle",...result},
        `[youtube-authorized-validation] cycle ${result.status}; session=${"sessionId" in result ? result.sessionId : "none"}; authorized=${String(metrics["authorizedDiscoveries"] ?? "n/a")}; comparator=${String(metrics["innertubeDiscoveries"] ?? "n/a")}; overlap=${String(metrics["overlap"] ?? "n/a")}; misses=${String(metrics["authorizedMisses"] ?? "n/a")}`);
    })
    .catch(error=>logger.error(safeErrorDetails(error,{job:"protected-live-validation"}),"[youtube-authorized-validation] run failed"));
  setTimeout(()=>run("startup"),15_000).unref();
  setInterval(()=>run("six-hour-check"),CHECK_MS).unref();
  logger.info({days:VALIDATION_DAYS,searchTarget:SEARCH_LOGICAL_TARGET,searchHardCap:SEARCH_REQUEST_HARD_CAP},"[youtube-authorized-validation] protected validation enabled");
}
