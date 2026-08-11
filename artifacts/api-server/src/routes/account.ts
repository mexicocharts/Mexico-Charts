import { Router } from "express";
import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  fanProfiles,
  monitoringSubscriptions,
  pool,
  savedArtists,
  userAccounts,
  userListeningEvents,
  userMusicConnections,
} from "@workspace/db";
import { clerkConfigured, clerkUserId, requireClerkUser } from "../lib/auth";
import { listSongstatsCatalogArtists } from "../lib/songstats-snapshot-service";
import {
  decryptConnectionValue,
  encryptConnectionValue,
  exchangeSpotifyCode,
  lastfmListening,
  lastfmUser,
  musicConnectionConfig,
  refreshSpotifyAccessToken,
  spotifyAuthorizationUrl,
  spotifyListening,
  spotifyMe,
  verifySpotifyState,
} from "../lib/user-music-connections";

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
    CREATE TABLE IF NOT EXISTS fan_profiles (
      clerk_user_id text PRIMARY KEY,
      username text NOT NULL UNIQUE,
      display_name text,
      bio text,
      account_type text NOT NULL DEFAULT 'personal',
      is_public boolean NOT NULL DEFAULT false,
      show_recent_listening boolean NOT NULL DEFAULT false,
      show_badges boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS fan_profiles_username_idx
      ON fan_profiles (username);
    ALTER TABLE fan_profiles
      ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'personal';
    CREATE TABLE IF NOT EXISTS user_music_connections (
      clerk_user_id text NOT NULL,
      provider text NOT NULL,
      external_user_id text,
      external_username text,
      access_token_encrypted text,
      refresh_token_encrypted text,
      scopes text,
      token_expires_at timestamptz,
      last_synced_at timestamptz,
      connected_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (clerk_user_id, provider)
    );
    CREATE INDEX IF NOT EXISTS user_music_connections_user_idx
      ON user_music_connections (clerk_user_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS user_listening_events (
      clerk_user_id text NOT NULL,
      provider text NOT NULL,
      event_id text NOT NULL,
      played_at timestamptz NOT NULL,
      track_id text,
      track_name text NOT NULL,
      artist_name text NOT NULL,
      album_name text,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (clerk_user_id, provider, event_id)
    );
    CREATE INDEX IF NOT EXISTS user_listening_events_recent_idx
      ON user_listening_events (clerk_user_id, played_at DESC);
  `);
  return ensureTablesPromise;
}

function cleanArtistKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().slice(0, 160);
}

function cleanArtistName(value: unknown): string {
  return String(value ?? "").trim().slice(0, 180);
}

function cleanUsername(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
}

function cleanProfileText(value: unknown, max: number): string | null {
  const cleaned = String(value ?? "").trim().slice(0, max);
  return cleaned || null;
}

function publicConnection(connection: typeof userMusicConnections.$inferSelect) {
  return {
    provider: connection.provider,
    externalUsername: connection.externalUsername,
    connectedAt: connection.connectedAt,
    lastSyncedAt: connection.lastSyncedAt,
  };
}

type ListeningEventInput = {
  provider: "lastfm" | "spotify";
  eventId: string;
  playedAt: Date;
  trackId: string | null;
  trackName: string;
  artistName: string;
  albumName: string | null;
};

function listeningEventId(parts: Array<string | number | null | undefined>) {
  return createHash("sha256").update(parts.map(part => String(part ?? "")).join("\u0000")).digest("hex");
}

function normalizeLastfmEvents(payload: unknown): ListeningEventInput[] {
  const tracks = (payload as { recenttracks?: { track?: unknown[] } })?.recenttracks?.track;
  if (!Array.isArray(tracks)) return [];
  return tracks.flatMap(raw => {
    const track = raw as {
      name?: string;
      mbid?: string;
      artist?: { name?: string; "#text"?: string };
      album?: { "#text"?: string };
      date?: { uts?: string };
      "@attr"?: { nowplaying?: string };
    };
    const timestamp = Number(track.date?.uts ?? 0);
    const trackName = track.name?.trim();
    const artistName = (track.artist?.name ?? track.artist?.["#text"])?.trim();
    if (!timestamp || !trackName || !artistName || track["@attr"]?.nowplaying === "true") return [];
    const playedAt = new Date(timestamp * 1000);
    return [{
      provider: "lastfm" as const,
      eventId: listeningEventId([timestamp, artistName, trackName, track.album?.["#text"]]),
      playedAt,
      trackId: track.mbid?.trim() || null,
      trackName,
      artistName,
      albumName: track.album?.["#text"]?.trim() || null,
    }];
  });
}

function normalizeSpotifyEvents(payload: unknown): ListeningEventInput[] {
  const items = (payload as { recent?: { items?: unknown[] } })?.recent?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap(raw => {
    const item = raw as {
      played_at?: string;
      track?: { id?: string; name?: string; artists?: Array<{ name?: string }>; album?: { name?: string } };
    };
    const playedAt = item.played_at ? new Date(item.played_at) : null;
    const trackName = item.track?.name?.trim();
    const artistName = item.track?.artists?.map(artist => artist.name?.trim()).filter(Boolean).join(", ");
    if (!playedAt || Number.isNaN(playedAt.getTime()) || !trackName || !artistName) return [];
    return [{
      provider: "spotify" as const,
      eventId: listeningEventId([item.played_at, item.track?.id, artistName, trackName]),
      playedAt,
      trackId: item.track?.id?.trim() || null,
      trackName,
      artistName,
      albumName: item.track?.album?.name?.trim() || null,
    }];
  });
}

async function saveListeningEvents(clerkUserId: string, events: ListeningEventInput[]) {
  if (!events.length) return;
  await db.insert(userListeningEvents).values(events.map(event => ({ clerkUserId, ...event }))).onConflictDoNothing();
}

router.get("/account/config", (_req, res) => {
  res.json({ configured: clerkConfigured(), musicConnections: musicConnectionConfig() });
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
    const [profile] = await db.select().from(fanProfiles)
      .where(eq(fanProfiles.clerkUserId, userId)).limit(1);
    const connections = await db.select().from(userMusicConnections)
      .where(eq(userMusicConnections.clerkUserId, userId));
    res.json({
      userId,
      plan: account?.plan ?? "free",
      subscriptionStatus: account?.subscriptionStatus ?? null,
      savedArtists: artists,
      monitoringSubscriptions: subscriptions,
      profile: profile ?? null,
      connections: connections.map(publicConnection),
      connectionAvailability: musicConnectionConfig(),
    });
  } catch (error) {
    _req.log.error({ error, userId }, "account load failed");
    res.status(500).json({ error: "Unable to load account" });
  }
});

router.patch("/account/profile", requireClerkUser, async (req, res) => {
  const userId = clerkUserId(res);
  const username = cleanUsername(req.body?.username);
  if (username.length < 3) {
    res.status(400).json({ error: "Username must contain at least 3 letters or numbers" });
    return;
  }
  try {
    await ensureAccountTables();
    const requestedAccountType = String(req.body?.accountType ?? "personal").trim().toLowerCase();
    const accountType = ["personal", "artist_team", "industry", "media", "research"].includes(requestedAccountType)
      ? requestedAccountType
      : "personal";
    const values = {
      clerkUserId: userId,
      username,
      displayName: cleanProfileText(req.body?.displayName, 80),
      bio: cleanProfileText(req.body?.bio, 280),
      accountType,
      isPublic: Boolean(req.body?.isPublic),
      showRecentListening: Boolean(req.body?.showRecentListening),
      showBadges: req.body?.showBadges !== false,
      updatedAt: new Date(),
    };
    const [profile] = await db.insert(fanProfiles).values(values).onConflictDoUpdate({
      target: fanProfiles.clerkUserId,
      set: values,
    }).returning();
    res.json({ profile });
  } catch (error) {
    req.log.error({ error, userId, username }, "account profile update failed");
    const message = error instanceof Error && /unique|duplicate/i.test(error.message)
      ? "That username is already in use"
      : "Unable to update account profile";
    res.status(message.includes("already") ? 409 : 500).json({ error: message });
  }
});

router.post("/account/connections/lastfm", requireClerkUser, async (req, res) => {
  const userId = clerkUserId(res);
  const username = String(req.body?.username ?? "").trim().slice(0, 80);
  if (!musicConnectionConfig().lastfm) {
    res.status(503).json({ error: "Last.fm connection is not configured yet" });
    return;
  }
  if (!username) {
    res.status(400).json({ error: "Last.fm username is required" });
    return;
  }
  try {
    const user = await lastfmUser(username);
    await ensureAccountTables();
    const [connection] = await db.insert(userMusicConnections).values({
      clerkUserId: userId,
      provider: "lastfm",
      externalUserId: user.name,
      externalUsername: user.name,
      lastSyncedAt: new Date(),
    }).onConflictDoUpdate({
      target: [userMusicConnections.clerkUserId, userMusicConnections.provider],
      set: { externalUserId: user.name, externalUsername: user.name, lastSyncedAt: new Date(), updatedAt: new Date() },
    }).returning();
    res.json({ connection: publicConnection(connection), playcount: user.playcount ?? null });
  } catch (error) {
    req.log.warn({ error, userId, username }, "Last.fm connection failed");
    res.status(400).json({ error: "We could not find that Last.fm username" });
  }
});

router.get("/account/connections/spotify/start", requireClerkUser, async (_req, res) => {
  if (!musicConnectionConfig().spotify) {
    res.status(503).json({ error: "Spotify connection is not configured yet" });
    return;
  }
  res.json({ authorizationUrl: spotifyAuthorizationUrl(clerkUserId(res)) });
});

router.get("/account/connections/spotify/callback", async (req, res) => {
  const code = String(req.query["code"] ?? "");
  const userId = verifySpotifyState(String(req.query["state"] ?? ""));
  if (!code || !userId || !musicConnectionConfig().spotify) {
    res.redirect("/cuenta?spotify=error");
    return;
  }
  try {
    const tokens = await exchangeSpotifyCode(code);
    const spotifyUser = await spotifyMe(tokens.access_token);
    await ensureAccountTables();
    await db.insert(userMusicConnections).values({
      clerkUserId: userId,
      provider: "spotify",
      externalUserId: spotifyUser.id,
      externalUsername: spotifyUser.display_name ?? spotifyUser.id,
      accessTokenEncrypted: encryptConnectionValue(tokens.access_token),
      refreshTokenEncrypted: tokens.refresh_token ? encryptConnectionValue(tokens.refresh_token) : null,
      scopes: tokens.scope ?? "user-read-recently-played user-top-read",
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      lastSyncedAt: new Date(),
    }).onConflictDoUpdate({
      target: [userMusicConnections.clerkUserId, userMusicConnections.provider],
      set: {
        externalUserId: spotifyUser.id,
        externalUsername: spotifyUser.display_name ?? spotifyUser.id,
        accessTokenEncrypted: encryptConnectionValue(tokens.access_token),
        ...(tokens.refresh_token ? { refreshTokenEncrypted: encryptConnectionValue(tokens.refresh_token) } : {}),
        scopes: tokens.scope ?? "user-read-recently-played user-top-read",
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    res.redirect("/cuenta?spotify=connected");
  } catch (error) {
    req.log.error({ error, userId }, "Spotify connection callback failed");
    res.redirect("/cuenta?spotify=error");
  }
});

router.delete("/account/connections/:provider", requireClerkUser, async (req, res) => {
  const userId = clerkUserId(res);
  const provider = String(req.params.provider ?? "").toLowerCase();
  if (!new Set(["lastfm", "spotify"]).has(provider)) {
    res.status(404).json({ error: "Unknown provider" });
    return;
  }
  await ensureAccountTables();
  await db.delete(userMusicConnections).where(and(
    eq(userMusicConnections.clerkUserId, userId),
    eq(userMusicConnections.provider, provider),
  ));
  await db.delete(userListeningEvents).where(and(
    eq(userListeningEvents.clerkUserId, userId),
    eq(userListeningEvents.provider, provider),
  ));
  res.status(204).end();
});

router.get("/account/listening", requireClerkUser, async (req, res) => {
  const userId = clerkUserId(res);
  try {
    await ensureAccountTables();
    const connections = await db.select().from(userMusicConnections)
      .where(eq(userMusicConnections.clerkUserId, userId));
    const result: Record<string, unknown> = {};
    const lastfm = connections.find(connection => connection.provider === "lastfm");
    if (lastfm?.externalUsername && musicConnectionConfig().lastfm) {
      const lastfmPayload = await lastfmListening(lastfm.externalUsername);
      await saveListeningEvents(userId, normalizeLastfmEvents(lastfmPayload));
      result["lastfm"] = { connected: true };
    }
    const spotify = connections.find(connection => connection.provider === "spotify");
    if (spotify?.accessTokenEncrypted && musicConnectionConfig().spotify) {
      let accessToken = decryptConnectionValue(spotify.accessTokenEncrypted);
      if (spotify.tokenExpiresAt && spotify.tokenExpiresAt.getTime() < Date.now() + 30_000 && spotify.refreshTokenEncrypted) {
        const refreshed = await refreshSpotifyAccessToken(decryptConnectionValue(spotify.refreshTokenEncrypted));
        accessToken = refreshed.access_token;
        await db.update(userMusicConnections).set({
          accessTokenEncrypted: encryptConnectionValue(accessToken),
          ...(refreshed.refresh_token ? { refreshTokenEncrypted: encryptConnectionValue(refreshed.refresh_token) } : {}),
          tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
          updatedAt: new Date(),
        }).where(and(
          eq(userMusicConnections.clerkUserId, userId),
          eq(userMusicConnections.provider, "spotify"),
        ));
      }
      const spotifyPayload = await spotifyListening(accessToken);
      await saveListeningEvents(userId, normalizeSpotifyEvents(spotifyPayload));
      result["spotify"] = { connected: true, topArtists: spotifyPayload.topArtists };
    }
    await db.update(userMusicConnections).set({ lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(userMusicConnections.clerkUserId, userId));
    const recentActivity = await db.select({
      provider: userListeningEvents.provider,
      playedAt: userListeningEvents.playedAt,
      trackName: userListeningEvents.trackName,
      artistName: userListeningEvents.artistName,
      albumName: userListeningEvents.albumName,
    }).from(userListeningEvents)
      .where(eq(userListeningEvents.clerkUserId, userId))
      .orderBy(desc(userListeningEvents.playedAt))
      .limit(200);
    const artistCounts = new Map<string, number>();
    for (const event of recentActivity) artistCounts.set(event.artistName, (artistCounts.get(event.artistName) ?? 0) + 1);
    const topArtists = [...artistCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([artistName, plays]) => ({ artistName, plays }));
    res.json({ listening: result, recentActivity, topArtists, storedEventsInResponseWindow: recentActivity.length });
  } catch (error) {
    req.log.error({ error, userId }, "fan listening load failed");
    res.status(502).json({ error: "Unable to refresh connected listening history" });
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
