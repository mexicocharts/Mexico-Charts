import { Router } from "express";
import { artistImageCacheStats, clearArtistImageCache, resolveArtistImages } from "../lib/artist-image-resolver";

const router = Router();

router.post("/admin/refresh-images", (_req, res) => {
  clearArtistImageCache();
  res.json({ ok: true, message: "Image resolver cache cleared; images will be revalidated on demand" });
});

router.get("/admin/image-stats", (_req, res) => {
  res.json(artistImageCacheStats());
});

/**
 * One image contract is shared by directory cards and profile heroes.
 * The default response remains a name → URL map for existing web/mobile clients.
 * `detailed=1` exposes classifications for audits and admin tooling.
 */
router.get("/spotify/artist-images", async (req, res) => {
  const namesParam = typeof req.query.names === "string" ? req.query.names : "";
  if (!namesParam.trim()) {
    res.status(400).json({ error: "names query parameter is required" });
    return;
  }

  const names = namesParam.split(",").map((name) => name.trim()).filter(Boolean);
  let resolutions;
  try {
    resolutions = await resolveArtistImages(names);
  } catch (error) {
    res.status(502).json({ error: "artist image resolver failed" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  if (req.query.detailed === "1") {
    res.json(Object.fromEntries(resolutions.map((resolution) => [resolution.artistName, resolution])));
    return;
  }
  res.json(Object.fromEntries(names.map((name) => [
    name,
    resolutions.find((resolution) => resolution.artistName === name)?.imageUrl ?? null,
  ])));
});

export default router;