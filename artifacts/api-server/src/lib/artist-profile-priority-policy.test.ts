import test from "node:test";
import assert from "node:assert/strict";
import { scoreArtistProfilePriority } from "./artist-profile-priority-policy";

test("puts a top-10 artist with major gaps in the urgent queue", () => {
  const result = scoreArtistProfilePriority({
    bestRank: 4,
    chartSources: 2,
    chartAppearances: 6,
    coverage: { spotify: true, youtube: false, appleMusic: false, deezer: false, musicbrainz: true, verifiedSocials: 0 },
  });
  assert.equal(result.priorityBand, "urgent");
  assert.deepEqual(result.missingProviders, ["youtube", "appleMusic", "deezer", "socials"]);
});

test("marks fully linked charting artists healthy instead of generating busywork", () => {
  const result = scoreArtistProfilePriority({
    bestRank: 1,
    chartSources: 4,
    chartAppearances: 20,
    coverage: { spotify: true, youtube: true, appleMusic: true, deezer: true, musicbrainz: true, verifiedSocials: 3 },
  });
  assert.equal(result.complete, true);
  assert.equal(result.priorityBand, "healthy");
  assert.deepEqual(result.missingProviders, []);
});

test("keeps low-chart-impact gaps below urgent", () => {
  const result = scoreArtistProfilePriority({
    bestRank: 180,
    chartSources: 1,
    chartAppearances: 1,
    coverage: { spotify: true, youtube: true, appleMusic: false, deezer: false, musicbrainz: true, verifiedSocials: 1 },
  });
  assert.equal(result.priorityBand, "normal");
});
