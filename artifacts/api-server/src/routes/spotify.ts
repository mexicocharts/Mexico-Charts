import { Router } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router = Router();

router.get("/spotify/artist-images", async (req, res) => {
  try {
    const namesParam = req.query.names as string;
    if (!namesParam?.trim()) {
      res.status(400).json({ error: "names query parameter is required" });
      return;
    }

    const names = namesParam.split(",").map((n) => n.trim()).filter(Boolean);
    const connectors = new ReplitConnectors();
    const results: Record<string, string | null> = {};

    await Promise.all(
      names.map(async (name) => {
        try {
          const response = await connectors.proxy(
            "spotify",
            `/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=1`,
          );
          const data = (await response.json()) as {
            artists?: {
              items?: Array<{ images?: Array<{ url: string }> }>;
            };
          };
          results[name] = data?.artists?.items?.[0]?.images?.[0]?.url ?? null;
        } catch {
          results[name] = null;
        }
      }),
    );

    res.json(results);
  } catch {
    res.status(500).json({ error: "Failed to fetch artist images" });
  }
});

export default router;
