import http from "node:http";
import {
  createReadStream,
  existsSync,
  readFileSync,
  statSync,
} from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const port = Number(process.env.PORT);
const basePath = normalizeBasePath(process.env.BASE_PATH);
const apiTarget = new URL(
  process.env.MONITOR_PRO_API_TARGET ?? "http://127.0.0.1:8099",
);
const staticRoot = resolve(
  process.env.MONITOR_PRO_STATIC_ROOT ??
    "/tmp/monitor-pro-preview-approved/artifacts/mexico-charts/dist/public",
);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error("A valid managed PORT is required.");
}

const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function normalizeBasePath(value) {
  const raw = value || "/";
  return `/${raw.replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
}

function reply(
  response,
  status,
  body,
  type = "application/json; charset=utf-8",
) {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function upstreamPath(requestUrl) {
  const url = new URL(requestUrl, "http://preview.local");
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    return `${url.pathname}${url.search}`;
  }

  const mountedApi = `${basePath}api`;
  if (
    url.pathname === mountedApi ||
    url.pathname.startsWith(`${mountedApi}/`)
  ) {
    return `/${url.pathname.slice(basePath.length)}${url.search}`;
  }

  return null;
}

function proxyApi(request, response, path) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    reply(
      response,
      405,
      JSON.stringify({ error: "Read-only Monitor Pro preview route required" }),
    );
    return;
  }

  const upstream = http.request(
    {
      protocol: apiTarget.protocol,
      hostname: apiTarget.hostname,
      port: apiTarget.port,
      method: request.method,
      path,
      headers: { ...request.headers, host: apiTarget.host },
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, {
        ...upstreamResponse.headers,
        "cache-control": "private, no-store",
      });
      upstreamResponse.pipe(response);
    },
  );

  upstream.on("error", () =>
    reply(
      response,
      502,
      JSON.stringify({ error: "Isolated preview API unavailable" }),
    ),
  );
  request.pipe(upstream);
}

function relativeStaticPath(requestUrl) {
  const url = new URL(requestUrl, "http://preview.local");
  const pathname = url.pathname.startsWith(basePath)
    ? url.pathname.slice(basePath.length)
    : url.pathname.replace(/^\/+/, "");
  return normalize(decodeURIComponent(pathname))
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]+/, "");
}

function safeFile(requestUrl) {
  const candidate = resolve(join(staticRoot, relativeStaticPath(requestUrl)));
  return candidate.startsWith(staticRoot) ? candidate : null;
}

function browserApiGuard() {
  const escapedBasePath = JSON.stringify(basePath);
  return `<script>
(() => {
  const basePath = ${escapedBasePath};
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === "string" && (input === "/api" || input.startsWith("/api/"))) {
      input = basePath + input.slice(1);
    } else if (input instanceof Request) {
      const url = new URL(input.url);
      if (url.origin === window.location.origin && (url.pathname === "/api" || url.pathname.startsWith("/api/"))) {
        url.pathname = basePath + url.pathname.slice(1);
        input = new Request(url, input);
      }
    }
    return originalFetch(input, init);
  };
})();
</script>`;
}

function serveIndex(request, response) {
  const indexPath = join(staticRoot, "index.html");
  const html = readFileSync(indexPath, "utf8").replace(
    "<head>",
    `<head>${browserApiGuard()}`,
  );
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  response.end(html);
}

const server = http.createServer((request, response) => {
  if (!request.url) {
    reply(response, 400, "Bad request", "text/plain; charset=utf-8");
    return;
  }

  const apiPath = upstreamPath(request.url);
  if (apiPath) {
    proxyApi(request, response, apiPath);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    reply(response, 405, "Method not allowed", "text/plain; charset=utf-8");
    return;
  }

  let file = safeFile(request.url);
  if (!file) {
    reply(response, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) {
    file = join(file, "index.html");
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    serveIndex(request, response);
    return;
  }
  if (file.endsWith("index.html")) {
    serveIndex(request, response);
    return;
  }

  response.writeHead(200, {
    "Content-Type":
      mime.get(extname(file).toLowerCase()) ?? "application/octet-stream",
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
});

server.listen(port, "0.0.0.0", () => {
  console.info("Monitor Pro private preview listening", { port, basePath });
});