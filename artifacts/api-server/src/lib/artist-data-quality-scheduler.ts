import { pool } from "@workspace/db";
import { logger } from "./logger";
import { getCurrentMexicanChartArtists } from "../routes/charts-hub";

const LOCK_KEY = 831_905_229;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const RUN_VERSION = 2;
let started = false;

function dateEt(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function ensureArtistDataQualityRuns(): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS artist_data_quality_runs (
    run_key text PRIMARY KEY,
    run_date text NOT NULL,
    completed_at timestamptz NOT NULL DEFAULT now(),
    summary jsonb NOT NULL
  )`);
}

export async function buildArtistDataQualitySummary() {
  const charting = await getCurrentMexicanChartArtists();
  const keys = charting.map(row => row.artistKey);
  const result = await pool.query<{
    artist_key: string; artist_name: string; songstats_eligible: boolean;
    spotify: boolean; youtube: boolean; apple_music: boolean; deezer: boolean;
    musicbrainz: boolean; verified_socials: string; review_socials: string;
    latest_kworb_date: string | null;
  }>(`
    SELECT c.artist_key, c.artist_name, COALESCE(c.songstats_eligible,false) AS songstats_eligible,
      EXISTS (SELECT 1 FROM spotify_artists s WHERE regexp_replace(translate(lower(s.artist_key),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g')=c.artist_key) AS spotify,
      EXISTS (SELECT 1 FROM youtube_channels y WHERE regexp_replace(translate(lower(y.artist_key),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g')=c.artist_key) AS youtube,
      (COALESCE(c.has_itunes,false) OR EXISTS (SELECT 1 FROM kworb_snapshots k WHERE k.artist_key=c.artist_key AND k.metric_type='itunes')) AS apple_music,
      EXISTS (SELECT 1 FROM deezer_track_covers d WHERE regexp_replace(translate(lower(d.artist_key),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g')=c.artist_key AND d.deezer_url IS NOT NULL) AS deezer,
      EXISTS (SELECT 1 FROM musicbrainz_artists m WHERE regexp_replace(translate(lower(m.artist_key),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g')=c.artist_key) AS musicbrainz,
      (SELECT count(DISTINCT a.platform) FROM artist_social_account_candidates a WHERE regexp_replace(translate(lower(a.artist_key),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g')=c.artist_key AND a.status='verified')::text AS verified_socials,
      (SELECT count(DISTINCT a.platform) FROM artist_social_account_candidates a WHERE regexp_replace(translate(lower(a.artist_key),'áéíóúüñ','aeiouun'),'[^a-z0-9]','','g')=c.artist_key AND a.status='review')::text AS review_socials,
      (SELECT max(k.fetched_at)::date::text FROM kworb_snapshots k WHERE k.artist_key=c.artist_key) AS latest_kworb_date
    FROM kworb_coverage c WHERE c.status='active' AND c.artist_key=ANY($1::text[])
  `, [keys]);
  const chartByKey = new Map(charting.map(row => [row.artistKey, row]));
  const rowsByKey = new Map(result.rows.map(row => [row.artist_key, row]));
  const artists = charting.map(chartRow => {
    const row = rowsByKey.get(chartRow.artistKey);
    return row ? ({
    artistKey: row.artist_key, artistName: row.artist_name, chart: chartByKey.get(row.artist_key),
    coverage: { spotify: row.spotify, youtube: row.youtube, appleMusic: row.apple_music, deezer: row.deezer,
      musicbrainz: row.musicbrainz, verifiedSocials: Number(row.verified_socials), reviewSocials: Number(row.review_socials) },
    songstatsEligible: row.songstats_eligible, latestKworbDate: row.latest_kworb_date, catalogStatus: "active" as const,
    }) : ({
      artistKey: chartRow.artistKey, artistName: chartRow.artistName, chart: chartRow,
      coverage: { spotify: false, youtube: false, appleMusic: false, deezer: false, musicbrainz: false, verifiedSocials: 0, reviewSocials: 0 },
      songstatsEligible: false, latestKworbDate: null, catalogStatus: "missing" as const,
    });
  });
  const missing = (field: "spotify" | "youtube" | "appleMusic" | "deezer" | "musicbrainz") => artists.filter(a => !a.coverage[field]).length;
  return {
    scope: "verified Mexican artists appearing in current official chart feeds",
    chartingArtists: artists.length,
    providerGaps: { spotify: missing("spotify"), youtube: missing("youtube"), appleMusic: missing("appleMusic"), deezer: missing("deezer"), musicbrainz: missing("musicbrainz") },
    withoutVerifiedSocials: artists.filter(a => a.coverage.verifiedSocials === 0).length,
    awaitingSocialReview: artists.filter(a => a.coverage.reviewSocials > 0).length,
    songstatsEligible: artists.filter(a => a.songstatsEligible).length,
    chartOnlyProfiles: artists.filter(a => !a.songstatsEligible).length,
    missingCatalogProfiles: artists.filter(a => a.catalogStatus === "missing").length,
    artists,
  };
}

export async function runScheduledArtistDataQuality() {
  const date = dateEt();
  const runKey = `${date}:v${RUN_VERSION}`;
  const client = await pool.connect();
  let locked = false;
  try {
    locked = (await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_KEY])).rows[0]?.locked === true;
    if (!locked) return { date, status: "locked" as const };
    await ensureArtistDataQualityRuns();
    if ((await client.query("SELECT 1 FROM artist_data_quality_runs WHERE run_key=$1", [runKey])).rowCount) return { date, status: "already_complete" as const };
    const summary = await buildArtistDataQualitySummary();
    await client.query("INSERT INTO artist_data_quality_runs(run_key,run_date,summary) VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING", [runKey, date, JSON.stringify(summary)]);
    return { date, status: "complete" as const, summary };
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}

export function startArtistDataQualityScheduler(): void {
  if (started || process.env["ARTIST_DATA_QUALITY_AUTOMATION_DISABLED"] === "true") return;
  started = true;
  const check = () => void runScheduledArtistDataQuality().catch(error => logger.error({ error }, "[artist-data-quality] daily run failed"));
  setTimeout(check, 45_000);
  setInterval(check, CHECK_INTERVAL_MS);
}
