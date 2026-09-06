/** Development-only launcher. Never import index.ts, app.ts or routes/index.ts. */
import express from "express";
import compression from "compression";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const MONITOR_APPLICATION_REVISION =
  "51c8a2e4e6fef4ff223227c03190eed091cb5dd0";

export function previewReadOnlyUrl(raw: string): string {
  const url = new URL(raw);
  if (!/^postgres(ql)?:$/.test(url.protocol))
    throw new Error("Preview requires PostgreSQL");
  // Process-local connection options; never persist or print the URL.
  url.searchParams.set(
    "options",
    `${url.searchParams.get("options") ?? ""} -c default_transaction_read_only=on`.trim(),
  );
  return url.toString();
}

export function previewRequestAllowed(method: string, path: string): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  return (
    /^\/api\/monitoring\/(config|access|internal\/(artists|directory|build)|dashboard\/[^/]+|report\/[^/]+|history\/[^/]+\/[^/]+)$/.test(
      path,
    ) ||
    path === "/api/image-proxy" ||
    path === "/api/preview-health"
  );
}

export async function startMonitorProPreview() {
  if (
    process.env["MONITOR_PRO_READONLY_PREVIEW"] !== "true" ||
    process.env["NODE_ENV"] === "production" ||
    process.env["REPLIT_DEPLOYMENT"]
  ) {
    throw new Error("Explicit development-only preview opt-in required");
  }
  const port = Number(process.env["PORT"] ?? "8080");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid preview port");
  const raw =
    process.env["NEON_DATABASE_URL"]?.trim() ||
    process.env["DATABASE_URL"]?.trim();
  if (!raw) throw new Error("Existing database configuration required");
  // Set before any database-dependent module is imported. All shared pools
  // inherit read-only PostgreSQL transactions in this preview process only.
  process.env["NEON_DATABASE_URL"] = previewReadOnlyUrl(raw);
  process.env["DATABASE_URL"] = process.env["NEON_DATABASE_URL"];
  const { pool, publicReadPool, monitoringReadPool } =
    await import("@workspace/db");
  // Founder acceptance can leave this isolated preview idle between tabs. Keep
  // its three read-only pool connections available so the next authenticated
  // request does not have to establish a cold Neon connection inside the
  // dashboard's strict serving budget. This changes no production pool and
  // starts no polling or background work.
  for (const readPool of [pool, publicReadPool, monitoringReadPool]) {
    readPool.options.idleTimeoutMillis = 0;
    readPool.options.keepAlive = true;
    readPool.options.keepAliveInitialDelayMillis = 10_000;
  }
  const previewDatabaseIdentity = await monitoringReadPool.query(
    "SELECT current_database() AS database_name, current_setting('application_name') AS application_name",
  );
  for (const readPool of [pool, publicReadPool, monitoringReadPool]) {
    const result = await readPool.query("SHOW transaction_read_only");
    if (result.rows[0]?.transaction_read_only !== "on")
      throw new Error("Preview database read-only guard failed");
  }
  const { optionalClerkAuth, clerkConfigured } = await import("./lib/auth");
  if (!clerkConfigured())
    throw new Error("Existing Clerk configuration required");
  const { logger } = await import("./lib/logger");
  const { default: monitoringRouter } = await import("./routes/monitoring");
  const { default: imageProxyRouter } = await import("./routes/image-proxy");
  const app = express();
  app.use(compression({ threshold: 1024 }));
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!previewRequestAllowed(req.method, req.path)) {
      res
        .status(405)
        .json({ error: "Read-only Monitor Pro preview route required" });
      return;
    }
    // Existing route diagnostics expect req.log. Avoid request/header logging.
    req.log = logger;
    next();
  });
  app.get("/api/preview-health", (_req, res) =>
    res.json({
      mode: "read-only-monitor-pro-preview",
      applicationRevision: MONITOR_APPLICATION_REVISION,
      databaseReadOnly: true,
      backgroundJobsStarted: false,
      databaseName: previewDatabaseIdentity.rows[0]?.database_name,
      databaseApplication: previewDatabaseIdentity.rows[0]?.application_name,
    }),
  );
  app.use(optionalClerkAuth);
  // Counts from the actual authenticated response, never headers, credentials,
  // raw provider payloads or a separately reconstructed dataset.
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/monitoring/dashboard/")) {
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (
          res.statusCode === 200 &&
          body?.subscription &&
          body?.spotifyCatalog
        ) {
          const items = body.spotifyCatalog.items ?? [];
          const tracks = items.filter(
            (item: { type: string }) => item.type === "track",
          );
          const videos = body.liveVideos ?? [];
          logger.info(
            {
              event: "monitor_preview_response_completeness",
              artistKey: body.subscription.artistKey,
              spotifySource: body.spotifyCatalog.source,
              tracks: tracks.length,
              albums: items.filter(
                (item: { type: string }) => item.type === "album",
              ).length,
              tracksWithLifetime: tracks.filter(
                (item: { totalStreams: unknown }) => item.totalStreams != null,
              ).length,
              tracksWithDaily: tracks.filter(
                (item: { dailyStreams: unknown }) => item.dailyStreams != null,
              ).length,
              tracksWithArtwork: tracks.filter(
                (item: { artworkUrl: unknown }) => Boolean(item.artworkUrl),
              ).length,
              albumsWithArtwork: items.filter(
                (item: { type: string; artworkUrl: unknown }) =>
                  item.type === "album" && Boolean(item.artworkUrl),
              ).length,
              spotifyHistory: body.spotifyCatalog.history?.length ?? 0,
              platformHistory: body.history?.length ?? 0,
              videos: videos.length,
              videosWithObservation: videos.filter(
                (video: { monitor_observed_at: unknown }) =>
                  Boolean(video.monitor_observed_at),
              ).length,
              videosWithDelta: videos.filter(
                (video: { view_delta: unknown }) => video.view_delta != null,
              ).length,
              videoHistory: body.liveVideoHistory?.length ?? 0,
              markets: body.topMexicoCities?.length ?? 0,
              comparisons: body.comparisonArtists?.length ?? 0,
              pulseSignals: body.dailyPulse?.signals?.length ?? 0,
              sectionStatus: body.sectionStatus,
            },
            "Authenticated private preview response counts",
          );
        }
        return originalJson(body);
      };
    }
    next();
  });
  app.use("/api", monitoringRouter);
  app.use("/api", imageProxyRouter);
  app.use(
    (
      _error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(500).json({ error: "Preview request failed" });
    },
  );
  return app.listen(port, "0.0.0.0", () => {
    console.info("Monitor Pro read-only preview listening", {
      port,
      applicationRevision: MONITOR_APPLICATION_REVISION,
    });
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void startMonitorProPreview().catch(() => {
    // Never print an error object that may contain connection credentials.
    console.error(
      "Monitor Pro preview refused startup; verify development opt-in, read-only database and Clerk configuration.",
    );
    process.exit(1);
  });
}
