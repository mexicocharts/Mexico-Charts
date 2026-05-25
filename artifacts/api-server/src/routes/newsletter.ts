import { Router } from "express";
import { db, pool } from "@workspace/db";
import { newsletterSubscribers } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = new Set(["home", "touring", "site"]);
const ADMIN_KEY = () => (
  process.env["NEWSLETTER_ADMIN_KEY"] ||
  process.env["YOUTUBE_ADMIN_KEY"] ||
  process.env["SPOTIFY_ADMIN_KEY"] ||
  ""
).trim();
let ensureTablePromise: Promise<unknown> | null = null;

function ensureNewsletterTable() {
  ensureTablePromise ??= pool.query(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      email text PRIMARY KEY,
      source text NOT NULL DEFAULT 'site',
      status text NOT NULL DEFAULT 'active',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  return ensureTablePromise;
}

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function cleanSource(value: unknown) {
  const source = typeof value === "string" ? value.trim().toLowerCase() : "site";
  return SOURCES.has(source) ? source : "site";
}

function isAdminAuthed(req: Parameters<Parameters<typeof router.get>[1]>[0]) {
  const key = ADMIN_KEY();
  const headerRaw = req.headers["x-admin-key"];
  const header = Array.isArray(headerRaw) ? headerRaw[0]?.trim() : headerRaw?.trim();
  const qkey = typeof req.query["adminKey"] === "string" ? req.query["adminKey"].trim() : undefined;
  return Boolean(key && (header === key || qkey === key));
}

router.post("/newsletter/subscribe", async (req, res) => {
  const email = cleanEmail(req.body?.email);
  const source = cleanSource(req.body?.source);

  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ ok: false, error: "Correo inválido" });
    return;
  }

  try {
    await ensureNewsletterTable();
    const now = new Date();
    await db
      .insert(newsletterSubscribers)
      .values({
        email,
        source,
        status: "active",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: newsletterSubscribers.email,
        set: {
          source,
          status: "active",
          updatedAt: now,
        },
      });

    res.json({ ok: true });
  } catch (error) {
    req.log.error({ error, email, source }, "newsletter subscribe failed");
    res.status(500).json({ ok: false, error: "No pudimos guardar tu correo" });
  }
});

router.get("/admin/newsletter/subscribers", async (req, res) => {
  if (!isAdminAuthed(req)) {
    res.status(403).json({ error: "Forbidden — provide X-Admin-Key header" });
    return;
  }

  try {
    await ensureNewsletterTable();
    const rows = await db
      .select()
      .from(newsletterSubscribers)
      .orderBy(desc(newsletterSubscribers.createdAt));

    const sources = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.source] = (acc[row.source] ?? 0) + 1;
      return acc;
    }, {});

    res.json({
      generatedAt: new Date().toISOString(),
      total: rows.length,
      sources,
      subscribers: rows.map(row => ({
        email: row.email,
        source: row.source,
        status: row.status,
        createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
        updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
      })),
    });
  } catch (error) {
    req.log.error({ error }, "newsletter admin list failed");
    res.status(500).json({ error: "No pudimos cargar los suscriptores" });
  }
});

export default router;
