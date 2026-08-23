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
  creditLineIncludesExactArtist,
  mergeCredits,
  titleHasExactLeadingArtistCredit,
} from "./youtube-music-shadow-discovery";

test("normalizes artist punctuation and accents without inventing aliases", () => {
  assert.equal(normalizeYoutubeArtistName("Julión Álvarez & Su Norteño Banda"), "julion alvarez and su norteno banda");
});

test("keeps exact YouTube Music credits in review instead of publishing them", () => {
  assert.deepEqual(decideYoutubeMusicCandidate({
    videoId: "LYhcqIQZ5-Y",
    credits: [{ name: "Peso Pluma", channelId: "UCzmabbKsmXlWnI9N2kKQ4lA" }],
    sourceSections: ["songs"],
  }, "Peso Pluma", "UCzmabbKsmXlWnI9N2kKQ4lA"), {
    status: "review",
    confidence: 90,
    reason: "exact_youtube_music_artist_credit",
  });
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

test("uses deterministic tier buckets and never exceeds the quota budget", () => {
  assert.equal(chooseYoutubeRefreshTier({ publishedAt: new Date(), viewCount: 10 }), "hot");
  assert.equal(chooseYoutubeRefreshTier({ dailyViewDelta: 75_000 }), "warm");
  assert.equal(chooseYoutubeRefreshTier({ viewCount: 2_000_000 }), "baseline");
  assert.equal(observationBucket(new Date("2026-08-19T12:29:59Z"), "hot").toISOString(), "2026-08-19T12:15:00.000Z");
  assert.equal(youtubeApiBatchesAllowed({ dailyBudget: 8_000, callsUsed: 7_999, requestedVideos: 101 }), 1);
  assert.equal(youtubeApiBatchesAllowed({ dailyBudget: 8_000, callsUsed: 8_000, requestedVideos: 50 }), 0);
  assert.equal(youtubeApiBatchesAllowed({ dailyBudget: 10_000, callsUsed: 9_998, requestedVideos: 150 }), 2);
});
