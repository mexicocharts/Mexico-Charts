import { logger } from "./logger";
import { pool, type PoolClient } from "@workspace/db";
import { archiveProprietaryCharts, type ProprietaryChartSheet } from "./proprietary-chart-archive";
import { refreshAndArchiveOfficialCharts } from "../routes/charts-hub";
import { chartEditionDate, mexicoChartArchiveDate, parseProprietaryChartCsv } from "./chart-archive-policy";

const MASTER_SHEET_ID = "1lnqsIqI3mi3eC7iD6H7QThS-tzZ4thyyHcYNfX3Vdts";
const PROPRIETARY_TABS = {
  MexicoCharts_Artists_Weekly: "artists_weekly_mx",
  MexicoCharts_Artists_Daily: "artists_daily_mx",
  MexicoCharts_Songs_Weekly: "songs_weekly_mx",
  MexicoCharts_Songs_Daily: "songs_daily_mx",
  MexicoCharts_Albums_Weekly: "albums_weekly_mx",
  MexicoCharts_Viral_Daily: "songs_viral_mx",
} as const;

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const LOCK_KEY = 392_410_619;
let running = false;

async function fetchProprietaryCharts(): Promise<Record<string, ProprietaryChartSheet>> {
  const chartDate = mexicoChartArchiveDate();
  const entries = await Promise.all(Object.entries(PROPRIETARY_TABS).map(async ([chartKey, tab]) => {
    const url = `https://docs.google.com/spreadsheets/d/${MASTER_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`${chartKey}: HTTP ${response.status}`);
    const parsed = parseProprietaryChartCsv(await response.text());
    return [chartKey, { ...parsed, chartDate: chartEditionDate(parsed.rows, chartDate) }] as const;
  }));
  return Object.fromEntries(entries);
}

export async function runChartArchive(reason: string): Promise<void> {
  if (running) return;
  running = true;
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_KEY]);
    if (!lock.rows[0]?.locked) {
      logger.info({ reason }, "[chart-archive] another worker owns archive lock");
      return;
    }
    const [official, proprietary] = await Promise.all([
      refreshAndArchiveOfficialCharts(),
      fetchProprietaryCharts().then(archiveProprietaryCharts),
    ]);
    logger.info({ reason, official: official.savedEditions, proprietary }, "[chart-archive] editions saved");
  } catch (err) {
    logger.error({ err, reason }, "[chart-archive] scheduled archive failed");
  } finally {
    if (client) {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
      client.release();
    }
    running = false;
  }
}

export function startChartArchiveScheduler(): void {
  if (process.env["CHART_ARCHIVE_AUTOMATION_DISABLED"] === "true") {
    logger.info("[chart-archive] scheduler disabled by environment");
    return;
  }
  const configured = Number(process.env["CHART_ARCHIVE_INTERVAL_MS"] ?? DEFAULT_INTERVAL_MS);
  const intervalMs = Number.isFinite(configured) && configured >= 60_000 ? configured : DEFAULT_INTERVAL_MS;
  setTimeout(() => void runChartArchive("startup"), 10_000);
  setInterval(() => void runChartArchive("schedule"), intervalMs);
  logger.info({ intervalMs }, "[chart-archive] scheduler started");
}
