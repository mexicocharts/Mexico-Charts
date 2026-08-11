import assert from "node:assert/strict";
import test from "node:test";
import {
  createSpotifyState,
  decryptConnectionValue,
  encryptConnectionValue,
  verifySpotifyState,
} from "./user-music-connections";

test("connection tokens are encrypted and can be decrypted", () => {
  const previous = process.env["MUSIC_CONNECTION_SECRET"];
  process.env["MUSIC_CONNECTION_SECRET"] = "test-only-secret-that-is-longer-than-thirty-two-characters";
  try {
    const encrypted = encryptConnectionValue("spotify-access-token");
    assert.notEqual(encrypted, "spotify-access-token");
    assert.equal(decryptConnectionValue(encrypted), "spotify-access-token");
  } finally {
    if (previous === undefined) delete process.env["MUSIC_CONNECTION_SECRET"];
    else process.env["MUSIC_CONNECTION_SECRET"] = previous;
  }
});

test("Spotify OAuth state is signed and rejects tampering", () => {
  const previous = process.env["MUSIC_CONNECTION_SECRET"];
  process.env["MUSIC_CONNECTION_SECRET"] = "test-only-secret-that-is-longer-than-thirty-two-characters";
  try {
    const state = createSpotifyState("user_123");
    assert.equal(verifySpotifyState(state), "user_123");
    assert.equal(verifySpotifyState(`${state}tampered`), null);
  } finally {
    if (previous === undefined) delete process.env["MUSIC_CONNECTION_SECRET"];
    else process.env["MUSIC_CONNECTION_SECRET"] = previous;
  }
});
