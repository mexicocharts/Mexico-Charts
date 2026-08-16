import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();
const ADMIN_KEY = () => (
  process.env["NEWSLETTER_ADMIN_KEY"] ||
  process.env["YOUTUBE_ADMIN_KEY"] ||
  process.env["SPOTIFY_ADMIN_KEY"] ||
  ""
).trim();
let ensureTablePromise: Promise<unknown> | null = null;

function ensureTable() {
  ensureTablePromise ??= pool.query(`
    CREATE TABLE IF NOT EXISTS community_contributions (
      id bigserial PRIMARY KEY,
      type text NOT NULL,
      artist_key text,
      artist_name text NOT NULL,
      link text,
      secondary_link text,
      mexico_connection text,
      context text,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  return ensureTablePromise;
}

function clean(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isHttpUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

router.post("/community/contributions", async (req, res) => {
  const type = clean(req.body?.type, 20);
  const artistKey = clean(req.body?.artistKey, 180);
  const artistName = clean(req.body?.artistName, 180);
  const link = clean(req.body?.link, 1200);
  const secondaryLink = clean(req.body?.secondaryLink, 1200);
  const mexicoConnection = clean(req.body?.mexicoConnection, 180);
  const context = clean(req.body?.context, 2500);

  if (!new Set(["correction", "artist_request"]).has(type) || !artistName) {
    res.status(400).json({ ok: false, error: "Faltan datos obligatorios" });
    return;
  }
  if (type === "correction" && !link) {
    res.status(400).json({ ok: false, error: "Agrega el enlace que deseas revisar" });
    return;
  }
  if (!isHttpUrl(link) || !isHttpUrl(secondaryLink)) {
    res.status(400).json({ ok: false, error: "Revisa que los enlaces sean válidos" });
    return;
  }

  try {
    await ensureTable();
    const result = await pool.query<{ id: string }>(`
      INSERT INTO community_contributions
        (type, artist_key, artist_name, link, secondary_link, mexico_connection, context)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [type, artistKey || null, artistName, link || null, secondaryLink || null, mexicoConnection || null, context || null]);
    res.status(201).json({ ok: true, id: result.rows[0]?.id });
  } catch (error) {
    req.log.error({ error, type, artistKey }, "community contribution failed");
    res.status(500).json({ ok: false, error: "No pudimos guardar el aporte" });
  }
});

router.get("/admin/community/contributions", async (req, res) => {
  const headerRaw = req.headers["x-admin-key"];
  const header = Array.isArray(headerRaw) ? headerRaw[0]?.trim() : headerRaw?.trim();
  if (!ADMIN_KEY() || header !== ADMIN_KEY()) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    await ensureTable();
    const result = await pool.query(`SELECT * FROM community_contributions ORDER BY created_at DESC LIMIT 1000`);
    res.json({ generatedAt: new Date().toISOString(), total: result.rowCount ?? 0, contributions: result.rows });
  } catch (error) {
    req.log.error({ error }, "community contributions list failed");
    res.status(500).json({ error: "No pudimos cargar los aportes" });
  }
});

export default router;
