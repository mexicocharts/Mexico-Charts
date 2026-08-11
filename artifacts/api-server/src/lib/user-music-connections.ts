import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_URL = "https://api.spotify.com/v1";

export type SpotifyTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

function connectionSecret(): string {
  return process.env["MUSIC_CONNECTION_SECRET"]?.trim() || "";
}

export function musicConnectionConfig() {
  return {
    lastfm: Boolean(process.env["LASTFM_API_KEY"]?.trim()),
    spotify: Boolean(
      process.env["SPOTIFY_CLIENT_ID"]?.trim()
      && process.env["SPOTIFY_CLIENT_SECRET"]?.trim()
      && process.env["SPOTIFY_USER_REDIRECT_URI"]?.trim()
      && connectionSecret().length >= 32,
    ),
  };
}

function encryptionKey() {
  const secret = connectionSecret();
  if (secret.length < 32) throw new Error("MUSIC_CONNECTION_SECRET must contain at least 32 characters");
  return createHash("sha256").update(secret).digest();
}

export function encryptConnectionValue(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(part => part.toString("base64url")).join(".");
}

export function decryptConnectionValue(value: string): string {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted connection value");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function createSpotifyState(clerkUserId: string): string {
  const payload = Buffer.from(JSON.stringify({
    userId: clerkUserId,
    expiresAt: Date.now() + 10 * 60 * 1000,
    nonce: randomBytes(12).toString("base64url"),
  })).toString("base64url");
  const signature = createHmac("sha256", connectionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySpotifyState(state: string): string | null {
  const [payload, signature] = state.split(".");
  if (!payload || !signature || connectionSecret().length < 32) return null;
  const expected = createHmac("sha256", connectionSecret()).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: string; expiresAt?: number };
    if (!parsed.userId || !parsed.expiresAt || parsed.expiresAt < Date.now()) return null;
    return parsed.userId;
  } catch {
    return null;
  }
}

export function spotifyAuthorizationUrl(clerkUserId: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env["SPOTIFY_CLIENT_ID"]!.trim(),
    redirect_uri: process.env["SPOTIFY_USER_REDIRECT_URI"]!.trim(),
    scope: "user-read-recently-played user-top-read",
    state: createSpotifyState(clerkUserId),
    show_dialog: "true",
  });
  return `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`;
}

async function spotifyTokenRequest(params: URLSearchParams): Promise<SpotifyTokens> {
  const credentials = Buffer.from(`${process.env["SPOTIFY_CLIENT_ID"]}:${process.env["SPOTIFY_CLIENT_SECRET"]}`).toString("base64");
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!response.ok) throw new Error(`Spotify token request failed (${response.status})`);
  return response.json() as Promise<SpotifyTokens>;
}

export function exchangeSpotifyCode(code: string): Promise<SpotifyTokens> {
  return spotifyTokenRequest(new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env["SPOTIFY_USER_REDIRECT_URI"]!.trim(),
  }));
}

export function refreshSpotifyAccessToken(refreshToken: string): Promise<SpotifyTokens> {
  return spotifyTokenRequest(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  }));
}

export async function spotifyMe(accessToken: string) {
  const response = await fetch(`${SPOTIFY_API_URL}/me`, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Spotify profile request failed (${response.status})`);
  return response.json() as Promise<{ id: string; display_name?: string }>;
}

export async function spotifyListening(accessToken: string) {
  const [recentResponse, shortResponse, mediumResponse, longResponse] = await Promise.all([
    fetch(`${SPOTIFY_API_URL}/me/player/recently-played?limit=50`, { headers: { authorization: `Bearer ${accessToken}` } }),
    fetch(`${SPOTIFY_API_URL}/me/top/artists?limit=10&time_range=short_term`, { headers: { authorization: `Bearer ${accessToken}` } }),
    fetch(`${SPOTIFY_API_URL}/me/top/artists?limit=10&time_range=medium_term`, { headers: { authorization: `Bearer ${accessToken}` } }),
    fetch(`${SPOTIFY_API_URL}/me/top/artists?limit=10&time_range=long_term`, { headers: { authorization: `Bearer ${accessToken}` } }),
  ]);
  if (![recentResponse, shortResponse, mediumResponse, longResponse].every(response => response.ok)) {
    throw new Error("Spotify listening request failed");
  }
  const [recent, shortTerm, mediumTerm, longTerm] = await Promise.all([
    recentResponse.json(), shortResponse.json(), mediumResponse.json(), longResponse.json(),
  ]);
  return { recent, topArtists: { shortTerm, mediumTerm, longTerm } };
}

export async function lastfmUser(username: string) {
  const params = new URLSearchParams({
    method: "user.getinfo",
    user: username,
    api_key: process.env["LASTFM_API_KEY"]!.trim(),
    format: "json",
  });
  const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params.toString()}`);
  if (!response.ok) throw new Error(`Last.fm profile request failed (${response.status})`);
  const payload = await response.json() as { user?: { name?: string; realname?: string; playcount?: string; url?: string }; error?: number };
  if (!payload.user?.name || payload.error) throw new Error("Last.fm user was not found");
  return payload.user;
}

export async function lastfmListening(username: string) {
  const params = new URLSearchParams({
    method: "user.getrecenttracks",
    user: username,
    api_key: process.env["LASTFM_API_KEY"]!.trim(),
    format: "json",
    extended: "1",
    limit: "200",
  });
  const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params.toString()}`);
  if (!response.ok) throw new Error(`Last.fm history request failed (${response.status})`);
  return response.json();
}
