import { Router, type IRouter } from "express";
import { readFileSync } from "fs";
import { join } from "path";

const router: IRouter = Router();

let cached: unknown = null;

router.get("/certifications", (_req, res) => {
  try {
    if (!cached) {
      const filePath = join(
        __dirname,
        "../../../artifacts/mexico-charts/public/certifications.json"
      );
      cached = JSON.parse(readFileSync(filePath, "utf-8"));
    }
    res.json(cached);
  } catch (err) {
    res.status(500).json({ error: "Failed to load certifications data" });
  }
});

export default router;
