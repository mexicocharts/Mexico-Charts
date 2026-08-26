import { Router } from "express";
import { logger } from "../lib/logger";
import { isArtistImageCandidateUrl, validateArtistImagePayload } from "../lib/artist-image-resolver";

const router = Router();

const ALLOWED_DOMAINS = new Set([
  "cdn-images.dzcdn.net",
  "cdns-images.dzcdn.net",
  "e-cdns-images.dzcdn.net",
  "i.scdn.co",
  "mosaic.scdn.co",
  "lineup-images.scdn.co",
  "seeded-session-images.scdn.co",
  "thisis-images.scdn.co",
  "image-cdn-ak.spotifycdn.com",
  "image-cdn-fa.spotifycdn.com",
  "is1-ssl.mzstatic.com",
  "is2-ssl.mzstatic.com",
  "is3-ssl.mzstatic.com",
  "is4-ssl.mzstatic.com",
  "is5-ssl.mzstatic.com",
  "a5.mzstatic.com",
]);

const proxyCache = new Map<string, { data: Buffer; contentType: string; cachedAt: number }>();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

router.get("/image-proxy", async (req, res) => {
  const rawUrl = req.query.url as string | undefined;

  if (!rawUrl) {
    res.status(400).json({ error: "url query parameter required" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    res.status(400).json({ error: "invalid URL" });
    return;
  }

  if (!ALLOWED_DOMAINS.has(parsed.hostname)) {
    res.status(403).json({ error: `domain not allowed: ${parsed.hostname}` });
    return;
  }
  if (!isArtistImageCandidateUrl(rawUrl)) {
    res.status(422).json({ error: "artist image URL is a placeholder or invalid" });
    return;
  }

  const cached = proxyCache.get(rawUrl);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    const cachedValidation = validateArtistImagePayload(cached.contentType, cached.data);
    if (cachedValidation.status !== "valid") {
      proxyCache.delete(rawUrl);
    } else {
      res.setHeader("Content-Type", cached.contentType);
      res.setHeader("Cache-Control", "public, max-age=7200, immutable");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("X-Image-Proxy", "HIT");
      res.send(cached.data);
      return;
    }
  }

  try {
    const response = await fetch(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MexicoCharts/1.0; +https://mexicochart.com)",
        "Accept": "image/webp,image/jpeg,image/png,image/*",
      },
    });

    if (!response.ok) {
      logger.warn({ status: response.status, url: rawUrl }, "[image-proxy] upstream failed");
      res.status(response.status).json({ error: "upstream fetch failed" });
      return;
    }

    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    const arrayBuffer = await response.arrayBuffer();
    const data = Buffer.from(arrayBuffer);
    const validation = validateArtistImagePayload(contentType, data);
    if (validation.status !== "valid") {
      logger.warn({ url: rawUrl, reason: validation.reason }, "[image-proxy] rejected invalid image payload");
      res.status(422).json({ error: validation.reason ?? validation.status });
      return;
    }

    proxyCache.set(rawUrl, { data, contentType, cachedAt: Date.now() });

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=7200, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Image-Proxy", "MISS");
    res.send(data);
  } catch (err) {
    logger.error({ err, url: rawUrl }, "[image-proxy] fetch error");
    res.status(502).json({ error: "proxy fetch failed" });
  }
});

export default router;
