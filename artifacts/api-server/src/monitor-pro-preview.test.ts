import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { previewReadOnlyUrl, previewRequestAllowed, startMonitorProPreview } from "./monitor-pro-preview";

test("preview only exposes read routes, never checkout or admin jobs", () => {
  for (const path of ["/api/monitoring/dashboard/peso-pluma", "/api/monitoring/history/luismiguel/spotifyFollowers", "/api/monitoring/report/natanael-cano", "/api/monitoring/internal/artists"]) {
    assert.equal(previewRequestAllowed("GET", path), true);
    assert.equal(previewRequestAllowed("POST", path), false);
  }
  for (const path of ["/api/monitoring/checkout", "/api/admin/youtube/music-shadow/intraday/run", "/api/monitoring/stripe-webhook", "/api/account"]) {
    assert.equal(previewRequestAllowed("GET", path), false);
    assert.equal(previewRequestAllowed("POST", path), false);
  }
});

test("preview appends read-only connection options without dropping existing settings", () => {
  const url = new URL(previewReadOnlyUrl("postgresql://test.invalid/db?sslmode=require&options=-c%20statement_timeout%3D10000"));
  assert.equal(url.searchParams.get("sslmode"), "require");
  assert.equal(url.searchParams.get("options"), "-c statement_timeout=10000 -c default_transaction_read_only=on");
});

test("launcher refuses to run without explicit preview approval", async () => {
  const previous = process.env["MONITOR_PRO_READONLY_PREVIEW"];
  delete process.env["MONITOR_PRO_READONLY_PREVIEW"];
  await assert.rejects(startMonitorProPreview(), /development-only/);
  if (previous !== undefined) process.env["MONITOR_PRO_READONLY_PREVIEW"] = previous;
});

test("preview transitive application imports exclude runtime jobs and production routers", async () => {
  const result = await build({
    entryPoints: [new URL("./monitor-pro-preview.ts", import.meta.url).pathname],
    bundle: true, write: false, metafile: true, platform: "node", format: "esm", packages: "external",
  });
  const imports = Object.keys(result.metafile!.inputs).join("\n");
  assert.match(imports, /routes\/monitoring\.ts/);
  assert.doesNotMatch(imports, /src\/(index|app)\.ts|routes\/(index|youtube|kworb|account|stripe-webhook)\.ts/);
  assert.doesNotMatch(imports, /scheduler|authorized-live-validation|intraday-shadow|retention|cleanup|announcement-monitor|alert-delivery|weekly-summary/);
});

test("preview keeps its read-only pools alive without starting a polling job", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("./monitor-pro-preview.ts", import.meta.url), "utf8"),
  );
  assert.match(source, /readPool\.options\.idleTimeoutMillis = 0/);
  assert.match(source, /readPool\.options\.keepAlive = true/);
  assert.match(source, /keepAliveInitialDelayMillis = 10_000/);
  assert.doesNotMatch(source, /setInterval|setTimeout/);
});
