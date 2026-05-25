import { Router } from "express";
import { db, pool } from "@workspace/db";
import { newsletterSubscribers } from "@workspace/db/schema";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = new Set(["home", "touring", "site"]);
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

export default router;
