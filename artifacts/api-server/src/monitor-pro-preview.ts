/** Development-only launcher. Never import index.ts, app.ts or routes/index.ts. */
import express from "express";
import compression from "compression";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const MONITOR_APPLICATION_REVISION = "51c8a2e4e6fef4ff223227c03190eed091cb5dd0";

export function previewReadOnlyUrl(raw: string): string {
  const url = new URL(raw);
  if (!/^postgres(ql)?:$/.test(url.protocol)) throw new Error("Preview requires PostgreSQL");
  // Process-local connection options; never persist or print the URL.
  url.searchParams.set("options", `${url.searchParams.get("options") ?? ""} -c default_transaction_read_only=on`.trim());
  return url.toString();
}

export function previewRequestAllowed(method: string, path: string): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  return /^\/api\/monitoring\/(config|internal\/artists|dashboard\/[^/]+|report\/[^/]+|history\/[^/]+\/[^/]+)$/.test(path)
    || path === "/api/image-proxy"
    || path === "/api/preview-health";
}

export async function startMonitorProPreview() {
  if (process.env["MONITOR_PRO_READONLY_PREVIEW"] !== "true"
    || process.env["NODE_ENV"] === "production"
    || process.env["REPLIT_DEPLOYMENT"]) {
    throw new Error("Explicit development-only preview opt-in required");
  }
  const port = Number(process.env["PORT"] ?? "8080");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid preview port");
  const raw = process.env["NEON_DATABASE_URL"]?.trim() || process.env["DATABASE_URL"]?.trim();
  if (!raw) throw new Error("Existing database configuration required");
  // Set before any database-dependent module is imported. All shared pools
  // inherit read-only PostgreSQL transactions in this preview process only.
  process.env["NEON_DATABASE_URL"] = previewReadOnlyUrl(raw);
  process.env["DATABASE_URL"] = process.env["NEON_DATABASE_URL"];
  const { pool, publicReadPool, monitoringReadPool } = await import("@workspace/db");
  for (const readPool of [pool, publicReadPool, monitoringReadPool]) {
    const result = await readPool.query("SHOW transaction_read_only");
    if (result.rows[0]?.transaction_read_only !== "on") throw new Error("Preview database read-only guard failed");
  }
  const { optionalClerkAuth, clerkConfigured } = await import("./lib/auth");
  if (!clerkConfigured()) throw new Error("Existing Clerk configuration required");
  const { logger } = await import("./lib/logger");
  const { default: monitoringRouter } = await import("./routes/monitoring");
  const { default: imageProxyRouter } = await import("./routes/image-proxy");
  const app = express();
  app.use(compression({ threshold: 1024 }));
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!previewRequestAllowed(req.method, req.path)) {
      res.status(405).json({ error: "Read-only Monitor Pro preview route required" });
      return;
    }
    // Existing route diagnostics expect req.log. Avoid request/header logging.
    req.log = logger;
    next();
  });
  app.get("/api/preview-health", (_req, res) => res.json({
    mode: "read-only-monitor-pro-preview",
    applicationRevision: MONITOR_APPLICATION_REVISION,
    databaseReadOnly: true,
    backgroundJobsStarted: false,
  }));
  app.use(optionalClerkAuth);
  app.use("/api", monitoringRouter);
  app.use("/api", imageProxyRouter);
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "Preview request failed" });
  });
  return app.listen(port, "0.0.0.0", () => {
    console.info("Monitor Pro read-only preview listening", { port, applicationRevision: MONITOR_APPLICATION_REVISION });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void startMonitorProPreview().catch(() => {
    // Never print an error object that may contain connection credentials.
    console.error("Monitor Pro preview refused startup; verify development opt-in, read-only database and Clerk configuration.");
    process.exit(1);
  });
}
