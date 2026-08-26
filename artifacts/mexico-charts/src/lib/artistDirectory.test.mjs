import test from "node:test";
import assert from "node:assert/strict";
import { artistProfileRoutes } from "../../scripts/artist-profile-routes.mjs";
import {
  auditArtistDirectoryRecords,
  directoryImageState,
} from "./artistDirectory.mjs";

function row(artistKey, displayName, overrides = {}) {
  return {
    artistKey,
    displayName,
    genre: "Hip-Hop",
    subgenre: "hip-hop",
    country: "Mexico",
    label: "",
    spotifyListeners: 100,
    spotifyFollowers: 10,
    spotifyStreams: 1000,
    spotifyPlaylistReach: 10,
    youtubeSubscribers: 10,
    youtubeViews: 100,
    tiktokFollowers: 10,
    instagramFollowers: 10,
    facebookFollowers: 0,
    deezerFans: 0,
    soundcloudFollowers: 0,
    ...overrides,
  };
}

test("canonical profile routes have unique slugs", () => {
  const slugs = artistProfileRoutes.map(route => route.path.replace(/^\/artist\//, ""));
  assert.equal(new Set(slugs).size, slugs.length);
  assert.ok(slugs.every(slug => slug && !slug.includes("/")));
});

test("directory audit merges only records that resolve to the same canonical profile", () => {
  const audit = auditArtistDirectoryRecords([
    row("aleman", "Alemán"),
    row("alemán", "Alemán", { genre: "Música mexicana", subgenre: "por clasificar" }),
    row("5050 flow malandro", "5050 Flow Malandro"),
    row("alex luna", "Alex Luna"),
    row("arox", "Arox"),
  ]);

  assert.equal(audit.artists.length, 2);
  assert.equal(audit.duplicateGroups.length, 1);
  assert.equal(audit.duplicateGroups[0].canonicalName, "Alemán");
  assert.deepEqual(
    audit.artists.map(artist => artist.profileHref).sort(),
    ["/artist/5050-flow-malandro", "/artist/aleman"],
  );
  assert.ok(audit.artists.every(artist => artist.profileHref.startsWith("/artist/")));
  assert.ok(audit.artists.every(artist => artist.profileHref !== "/artists"));
  assert.equal(
    new Set(audit.artists.map(artist => artist.profileHref)).size,
    audit.artists.length,
  );
  assert.deepEqual(audit.excluded.map(artist => artist.displayName), ["Alex Luna", "Arox"]);
});

test("directory image states never replace a known candidate with initials while pending", () => {
  const loading = directoryImageState({
    primaryUrl: "https://cdn.example.test/aleman.jpg",
    fallbackUrl: "https://cdn.example.test/aleman-fallback.jpg",
    imageLookupReady: false,
  });
  assert.equal(loading.state, "image");

  const recovering = directoryImageState({
    primaryUrl: "https://cdn.example.test/aleman.jpg",
    fallbackUrl: "https://cdn.example.test/aleman-fallback.jpg",
    imageLookupReady: true,
    fallbackLookupLoading: true,
    failedUrls: new Set(["https://cdn.example.test/aleman.jpg"]),
  });
  assert.equal(recovering.state, "image");

  const waitingForFallback = directoryImageState({
    primaryUrl: "https://cdn.example.test/aleman.jpg",
    fallbackUrl: null,
    imageLookupReady: true,
    fallbackLookupLoading: true,
    failedUrls: new Set(["https://cdn.example.test/aleman.jpg"]),
  });
  assert.equal(waitingForFallback.state, "loading");

  const exhausted = directoryImageState({
    primaryUrl: "https://cdn.example.test/aleman.jpg",
    fallbackUrl: "https://cdn.example.test/aleman-fallback.jpg",
    imageLookupReady: true,
    failedUrls: new Set([
      "https://cdn.example.test/aleman.jpg",
      "https://cdn.example.test/aleman-fallback.jpg",
    ]),
  });
  assert.equal(exhausted.state, "initial");

  assert.equal(
    directoryImageState({
      primaryUrl: "not-an-image-url",
      imageLookupReady: true,
    }).state,
    "initial",
  );
});