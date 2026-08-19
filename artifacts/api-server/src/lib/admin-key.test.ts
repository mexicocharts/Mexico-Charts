import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardAdminKey } from "./admin-key";

test("uses the same primary admin key as the coverage dashboard", () => {
  assert.equal(getDashboardAdminKey({
    NEWSLETTER_ADMIN_KEY: " main-dashboard-key ",
    YOUTUBE_ADMIN_KEY: "youtube-only-key",
    SPOTIFY_ADMIN_KEY: "spotify-only-key",
  }), "main-dashboard-key");
});

test("falls back to provider admin keys when the main key is unavailable", () => {
  assert.equal(getDashboardAdminKey({ YOUTUBE_ADMIN_KEY: "youtube-key" }), "youtube-key");
  assert.equal(getDashboardAdminKey({ SPOTIFY_ADMIN_KEY: "spotify-key" }), "spotify-key");
  assert.equal(getDashboardAdminKey({}), "");
});
