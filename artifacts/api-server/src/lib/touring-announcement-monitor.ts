import { createHash } from "node:crypto";
import { pool } from "@workspace/db";
import { logger } from "./logger";

const CHECK_MS = 6 * 60 * 60 * 1000;
let started = false;

async function ensureColumns() {
  await pool.query(`CREATE TABLE IF NOT EXISTS touring_announcement_sources (
      id bigserial PRIMARY KEY, artist_id text NOT NULL, artist_name text NOT NULL,
      source_type text NOT NULL CHECK(source_type IN ('artist','promoter','venue')),
      source_url text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'active',
      last_checked_at timestamptz,last_changed_at timestamptz,last_error text,content_hash text,etag text,last_modified text,
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE touring_announcement_sources ADD COLUMN IF NOT EXISTS content_hash text;
    ALTER TABLE touring_announcement_sources ADD COLUMN IF NOT EXISTS etag text;
    ALTER TABLE touring_announcement_sources ADD COLUMN IF NOT EXISTS last_modified text;`);
  await pool.query(`CREATE TABLE IF NOT EXISTS touring_alert_outbox (
    id bigserial PRIMARY KEY,alert_type text NOT NULL,artist_id text,artist_name text,title text NOT NULL,
    message text NOT NULL,source_url text,event_id text,dedupe_key text NOT NULL UNIQUE,status text NOT NULL DEFAULT 'pending',
    attempts integer NOT NULL DEFAULT 0,available_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
  );`);
  await pool.query(`CREATE TABLE IF NOT EXISTS touring_review_queue (
    id bigserial PRIMARY KEY, review_type text NOT NULL, artist_id text, artist_name text NOT NULL,
    event_id text, title text NOT NULL, source_url text, evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz, UNIQUE(review_type,artist_id,event_id,title))`);
}

export async function runTouringAnnouncementMonitor() {
  await ensureColumns();
  const sources = await pool.query<{ id: string; source_url: string; content_hash: string | null; etag: string | null; last_modified: string | null }>(
    `SELECT id,source_url,content_hash,etag,last_modified FROM touring_announcement_sources WHERE status='active' ORDER BY last_checked_at NULLS FIRST LIMIT 100`,
  );
  let checked = 0, changed = 0, failed = 0;
  for (const source of sources.rows) {
    try {
      const response = await fetch(source.source_url, { headers: {
        "User-Agent": "MexicoChartsTouringMonitor/1.0 (+https://mexicochart.com/touring)",
        ...(source.etag ? { "If-None-Match": source.etag } : {}),
        ...(source.last_modified ? { "If-Modified-Since": source.last_modified } : {}),
      }, signal: AbortSignal.timeout(20_000) });
      checked += 1;
      if (response.status === 304) {
        await pool.query(`UPDATE touring_announcement_sources SET last_checked_at=now(),last_error=NULL,updated_at=now() WHERE id=$1`, [source.id]);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") ?? "";
      if (!/text\/html|application\/json|application\/xml|text\/xml/iu.test(contentType)) throw new Error(`Unsupported content type: ${contentType}`);
      const body = (await response.text()).slice(0, 2_000_000);
      const hash = createHash("sha256").update(body).digest("hex");
      const didChange = Boolean(source.content_hash && source.content_hash !== hash);
      if (didChange) changed += 1;
      await pool.query(`UPDATE touring_announcement_sources SET content_hash=$2,etag=$3,last_modified=$4,last_checked_at=now(),
        last_changed_at=CASE WHEN $5 THEN now() ELSE last_changed_at END,last_error=NULL,updated_at=now() WHERE id=$1`,
        [source.id,hash,response.headers.get("etag"),response.headers.get("last-modified"),didChange]);
      if (didChange) {
        await pool.query(`INSERT INTO touring_alert_outbox(alert_type,artist_id,artist_name,title,message,source_url,dedupe_key)
          SELECT 'official_source_changed',artist_id,artist_name,$2,$3,source_url,$4 FROM touring_announcement_sources WHERE id=$1
          ON CONFLICT(dedupe_key) DO NOTHING`, [source.id,"Posible actualización oficial de gira","Una fuente oficial monitoreada cambió. Mexico Charts la revisará antes de tratarla como anuncio confirmado.",`source:${source.id}:${hash}`]);
        await pool.query(`INSERT INTO touring_review_queue(review_type,artist_id,artist_name,title,source_url,evidence)
          SELECT 'artist_discovery',artist_id,artist_name,'Revisar actualización de fuente autorizada',source_url,
            jsonb_build_object('sourceType',source_type,'contentHash',$2)
          FROM touring_announcement_sources WHERE id=$1
          ON CONFLICT(review_type,artist_id,event_id,title) DO NOTHING`, [source.id, hash]);
      }
    } catch (error) {
      failed += 1;
      await pool.query(`UPDATE touring_announcement_sources SET last_checked_at=now(),last_error=$2,updated_at=now() WHERE id=$1`,
        [source.id,error instanceof Error ? error.message.slice(0,500) : "Unknown error"]);
    }
  }
  return { checked, changed, failed };
}

async function check() {
  try { logger.info(await runTouringAnnouncementMonitor(), "[touring-announcements] check complete"); }
  catch (error) { logger.error({ error }, "[touring-announcements] check failed"); }
}

export function startTouringAnnouncementMonitor() {
  if (started || process.env["TOURING_ANNOUNCEMENT_MONITOR_ENABLED"] === "false") return;
  started = true;
  setTimeout(() => void check(), 45_000);
  const timer = setInterval(() => void check(), CHECK_MS);
  timer.unref();
}
