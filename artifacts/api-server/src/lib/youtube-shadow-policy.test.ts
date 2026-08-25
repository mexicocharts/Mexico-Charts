import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseYoutubeRefreshTier,
  decideYoutubeMusicCandidate,
  normalizeYoutubeArtistName,
  observationBucket,
  youtubeApiBatchesAllowed,
} from "./youtube-shadow-policy";
import {
  chooseExactYoutubeArtistMatch,
  collectYoutubeMusicArtistItems,
  creditLineIncludesExactArtist,
  isMissingMusicShelfError,
  mergeCredits,
  resolveTrustedYoutubeIdentity,
  titleHasExactLeadingArtistCredit,
  withYoutubeInnertubeRetry,
  YoutubeRetryableError,
} from "./youtube-music-shadow-discovery";

test("normalizes artist punctuation and accents without inventing aliases", () => {
  assert.equal(normalizeYoutubeArtistName("Julión Álvarez & Su Norteño Banda"), "julion alvarez and su norteno banda");
});

test("verifies a candidate only when its credited channel matches the verified identity", () => {
  assert.deepEqual(decideYoutubeMusicCandidate({
    videoId: "LYhcqIQZ5-Y",
    credits: [{ name: "Peso Pluma", channelId: "UCzmabbKsmXlWnI9N2kKQ4lA" }],
    sourceSections: ["songs"],
  }, "Peso Pluma", "UCzmabbKsmXlWnI9N2kKQ4lA"), {
    status: "verified",
    confidence: 100,
    reason: "verified_youtube_artist_credit",
  });
  assert.deepEqual(decideYoutubeMusicCandidate({
    videoId: "LYhcqIQZ5-Y",
    credits: [{ name: "Peso Pluma" }],
    sourceSections: ["shared_label"],
  }, "Peso Pluma", "UCzmabbKsmXlWnI9N2kKQ4lA"), {
    status: "review",
    confidence: 78,
    reason: "exact_normalized_artist_credit",
  });
  assert.equal(decideYoutubeMusicCandidate({
    videoId: "LYhcqIQZ5-Y",
    credits: [],
    sourceSections: ["uploads"],
    uploaderChannelId: "UCzmabbKsmXlWnI9N2kKQ4lA",
  }, "Peso Pluma", "UCzmabbKsmXlWnI9N2kKQ4lA").status, "verified");
});

test("rejects malformed IDs and unrelated credits", () => {
  assert.equal(decideYoutubeMusicCandidate({
    videoId: "too-short",
    credits: [{ name: "Peso Pluma" }],
    sourceSections: ["songs"],
  }, "Peso Pluma", "browse").status, "rejected");
  assert.equal(decideYoutubeMusicCandidate({
    videoId: "LYhcqIQZ5-Y",
    credits: [{ name: "Different Artist" }],
    sourceSections: ["songs"],
  }, "Peso Pluma", "browse").status, "rejected");
});

test("merges explicit album and video credits without duplicates", () => {
  assert.deepEqual(mergeCredits(
    [{ name: "Peso Pluma", channelId: "UCpeso" }],
    [
      { name: "Peso Pluma", channelId: "UCpeso" },
      { name: "Junior H", channelId: "UCjunior" },
    ],
  ), [
    { name: "Peso Pluma", channelId: "UCpeso" },
    { name: "Junior H", channelId: "UCjunior" },
  ]);
});

test("recognizes an exact artist in an explicit album credit line", () => {
  assert.equal(creditLineIncludesExactArtist("BNYX®, Bizarrap, Yeat & Peso Pluma", "Peso Pluma"), true);
  assert.equal(creditLineIncludesExactArtist("Peso Pluma & Tito Double P", "Peso Pluma"), true);
  assert.equal(creditLineIncludesExactArtist("Jesse & Joy & Guest Artist", "Jesse & Joy"), true);
  assert.equal(creditLineIncludesExactArtist("Peso Pesado", "Peso"), false);
});

test("only accepts strict leading artist credits from a shared label channel", () => {
  assert.equal(titleHasExactLeadingArtistCredit("Luis Miguel - Hasta Que Me Olvides (En Vivo)", "Luis Miguel"), true);
  assert.equal(titleHasExactLeadingArtistCredit("LUIS MIGUEL | La Incondicional", "Luis Miguel"), true);
  assert.equal(titleHasExactLeadingArtistCredit("Luis Miguel: Ahora Te Puedes Marchar", "Luis Miguel"), true);
  assert.equal(titleHasExactLeadingArtistCredit("Luis Miguel del Amargue - Se Acabó Lo Bonito", "Luis Miguel"), false);
  assert.equal(titleHasExactLeadingArtistCredit("Warner presenta a Luis Miguel", "Luis Miguel"), false);
  assert.equal(titleHasExactLeadingArtistCredit("Luis Fonsi - Despacito", "Luis Miguel"), false);
});

test("uses a single trusted identity to disambiguate exact name matches without guessing", () => {
  const matches = [
    { browseId: "UCfirst", name: "Peso Pluma" },
    { browseId: "UCtrusted", name: "Peso Pluma" },
  ];
  assert.deepEqual(chooseExactYoutubeArtistMatch("Peso Pluma", matches, ["UCtrusted"]), {
    browseId: "UCtrusted",
    ambiguous: false,
  });
  assert.deepEqual(chooseExactYoutubeArtistMatch("Peso Pluma", matches), {
    browseId: null,
    ambiguous: true,
  });
});

test("canonicalizes a stored verified YouTube channel URL before discovery", async () => {
  const client = {
    query: async <T>() => ({
      rows: [{
        browse_id: "https://www.youtube.com/channel/UCQHnOnsryRQmmr6pU3lAupg?feature=shared",
        source: "youtube_channel",
        exact_key: true,
        artist_key: "luis-miguel",
        artist_name: null,
      }] as T[],
    }),
    release: () => {},
  };
  const resolved = await resolveTrustedYoutubeIdentity(client, "luis-miguel", "Luis Miguel");
  assert.deepEqual(resolved, {
    identity: {
      browseId: "UCQHnOnsryRQmmr6pU3lAupg",
      source: "youtube_channel",
    },
    ambiguous: false,
    candidates: [{ browseId: "UCQHnOnsryRQmmr6pU3lAupg", name: "Luis Miguel" }],
  });
});

test("does not apply a verified YouTube Music mapping from a homonymous artist key", async () => {
  const client = {
    query: async <T>() => ({
      rows: [
        {
          browse_id: "UCotherartist",
          source: "verified_youtube_music_mapping",
          exact_key: false,
          artist_key: "peso-pluma-other",
          artist_name: "Peso Pluma",
        },
        {
          browse_id: "UCpesoartist",
          source: "verified_youtube_music_mapping",
          exact_key: false,
          artist_key: "peso-pluma",
          artist_name: "Peso Pluma",
        },
      ] as T[],
    }),
    release: () => {},
  };
  const resolved = await resolveTrustedYoutubeIdentity(client, "peso-pluma", "Peso Pluma");
  assert.deepEqual(resolved, {
    identity: {
      browseId: "UCpesoartist",
      source: "verified_youtube_music_mapping",
    },
    ambiguous: false,
    candidates: [{ browseId: "UCpesoartist", name: "Peso Pluma" }],
  });
});

test("retries transient YouTube Music errors with Retry-After before succeeding", async () => {
  let attempts = 0;
  const waits: number[] = [];
  const value = await withYoutubeInnertubeRetry(async () => {
    attempts += 1;
    if (attempts === 1) {
      throw { status: 403, headers: { "retry-after": "1" }, message: "YouTube 403" };
    }
    return "recovered";
  }, {
    sleep: async delay => { waits.push(delay); },
    random: () => 0,
  });
  assert.equal(value, "recovered");
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [1_000]);
});

test("marks exhausted transient YouTube Music failures as retryable", async () => {
  await assert.rejects(
    () => withYoutubeInnertubeRetry(
      async () => { throw { status: 429, message: "rate limited" }; },
      { maxAttempts: 2, sleep: async () => {}, random: () => 0 },
    ),
    error => error instanceof YoutubeRetryableError
      && error.statusCode === 429
      && error.attempts === 2,
  );
});

test("continues catalog parsing when optional MusicShelf content is missing", () => {
  assert.equal(isMissingMusicShelfError(new Error("Missing MusicShelf node")), true);
  assert.deepEqual(collectYoutubeMusicArtistItems({
    sections: undefined,
    albums: { contents: [{ id: "MPREalbum", item_type: "album" }] },
    videos: { contents: [{ id: "LYhcqIQZ5-Y", item_type: "video" }] },
  }).map(entry => entry.sourceSection), ["albums", "videos"]);
});

test("uses deterministic tier buckets and never exceeds the quota budget", () => {
  assert.equal(chooseYoutubeRefreshTier({ publishedAt: new Date(), viewCount: 10 }), "hot");
  assert.equal(chooseYoutubeRefreshTier({ dailyViewDelta: 75_000 }), "warm");
  assert.equal(chooseYoutubeRefreshTier({ viewCount: 2_000_000 }), "baseline");
  assert.equal(observationBucket(new Date("2026-08-19T12:29:59Z"), "hot").toISOString(), "2026-08-19T12:15:00.000Z");
  assert.equal(youtubeApiBatchesAllowed({ dailyBudget: 8_000, callsUsed: 7_999, requestedVideos: 101 }), 1);
  assert.equal(youtubeApiBatchesAllowed({ dailyBudget: 8_000, callsUsed: 8_000, requestedVideos: 50 }), 0);
  assert.equal(youtubeApiBatchesAllowed({ dailyBudget: 10_000, callsUsed: 9_998, requestedVideos: 150 }), 2);
});
