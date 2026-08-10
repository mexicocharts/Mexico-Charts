import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, monitoringSubscriptions, pool, savedArtists, userAccounts } from "@workspace/db";
import { clerkConfigured, clerkUserId, requireClerkUser } from "../lib/auth";
import { listSongstatsCatalogArtists } from "../lib/songstats-snapshot-service";

const router = Router();
let ensureTablesPromise: Promise<unknown> | null = null;

function ensureAccountTables() {
  ensureTablesPromise ??= pool.query(`
    CREATE TABLE IF NOT EXISTS user_accounts (
      clerk_user_id text PRIMARY KEY,
      email text,
      display_name text,
      plan text NOT NULL DEFAULT 'free',
      stripe_customer_id text,
      stripe_subscription_id text,
      subscription_status text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS saved_artists (
      clerk_user_id text NOT NULL,
      artist_key text NOT NULL,
      artist_name text NOT NULL,
      alerts_enabled boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (clerk_user_id, artist_key)
    );
    CREATE INDEX IF NOT EXISTS saved_artists_user_created_idx
      ON saved_artists (clerk_user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS monitoring_subscriptions (
      stripe_subscription_id text PRIMARY KEY,
      clerk_user_id text NOT NULL,
      artist_key text NOT NULL,
      artist_name text NOT NULL,
      status text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS monitoring_subscriptions_user_idx
      ON monitoring_subscriptions (clerk_user_id, updated_at DESC);
  `);
  return ensureTablesPromise;
}

function cleanArtistKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().slice(0, 160);
}

function cleanArtistName(value: unknown): string {
  return String(value ?? "").trim().slice(0, 180);
}

router.get("/account/config", (_req, res) => {
  res.json({ configured: clerkConfigured() });
});

router.get("/account/me", requireClerkUser, async (_req, res) => {
  const userId = clerkUserId(res);
  try {
    await ensureAccountTables();
    await db.insert(userAccounts).values({ clerkUserId: userId }).onConflictDoNothing();
    const [account] = await db.select().from(userAccounts).where(eq(userAccounts.clerkUserId, userId)).limit(1);
    const artists = await db.select().from(savedArtists)
      .where(eq(savedArtists.clerkUserId, userId))
      .orderBy(desc(savedArtists.createdAt));
    const subscriptions = await db.select().from(monitoringSubscriptions)
      .where(eq(monitoringSubscriptions.clerkUserId, userId))
      .orderBy(desc(monitoringSubscriptions.updatedAt));
    res.json({
      userId,
      plan: account?.plan ?? "free",
      subscriptionStatus: account?.subscriptionStatus ?? null,
      savedArtists: artists,
      monitoringSubscriptions: subscriptions,
    });
  } catch (error) {
    _req.log.error({ error, userId }, "account load failed");
    res.status(500).json({ error: "Unable to load account" });
  }
});

router.post("/account/saved-artists", requireClerkUser, async (req, res) => {
  const userId = clerkUserId(res);
  const artistKey = cleanArtistKey(req.body?.artistKey);
  const artistName = cleanArtistName(req.body?.artistName);
  if (!artistKey || !artistName) {
    res.status(400).json({ error: "artistKey and artistName are required" });
    return;
  }
  try {
    const [catalogArtist] = await listSongstatsCatalogArtists({ limit: 1, artistKeys: [artistKey] });
    if (!catalogArtist) {
      res.status(404).json({ error: "Artist is not in the active catalog" });
      return;
    }
    const canonicalName = catalogArtist.spotifyName?.trim() || artistName;
    await ensureAccountTables();
    await db.insert(userAccounts).values({ clerkUserId: userId }).onConflictDoNothing();
    const [saved] = await db.insert(savedArtists).values({
      clerkUserId: userId,
      artistKey,
      artistName: canonicalName,
    }).onConflictDoUpdate({
      target: [savedArtists.clerkUserId, savedArtists.artistKey],
      set: { artistName: canonicalName },
    }).returning();
    res.status(201).json({ savedArtist: saved });
  } catch (error) {
    req.log.error({ error, userId, artistKey }, "save artist failed");
    res.status(500).json({ error: "Unable to save artist" });
  }
});

router.delete("/account/saved-artists/:artistKey", requireClerkUser, async (req, res) => {
  const userId = clerkUserId(res);
  const artistKey = cleanArtistKey(req.params.artistKey);
  try {
    await ensureAccountTables();
    await db.delete(savedArtists).where(and(
      eq(savedArtists.clerkUserId, userId),
      eq(savedArtists.artistKey, artistKey),
    ));
    res.status(204).end();
  } catch (error) {
    req.log.error({ error, userId, artistKey }, "remove saved artist failed");
    res.status(500).json({ error: "Unable to remove saved artist" });
  }
});

export default router;
