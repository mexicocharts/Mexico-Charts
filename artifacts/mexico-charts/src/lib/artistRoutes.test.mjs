import test from "node:test";
import assert from "node:assert/strict";
import {
  artistCatalogCount,
  canonicalArtistHref,
  resolveCanonicalArtist,
} from "./artistRoutes.mjs";

test("catalog contains the legacy roster plus the provider-backed artists", () => {
  assert.equal(artistCatalogCount, 563);
});

test("canonical and compact artist identifiers resolve to one profile", () => {
  const cases = [
    ["fuerza-regida", "/artist/fuerza-regida"],
    ["fuerzaregida", "/artist/fuerza-regida"],
    ["Peso Pluma", "/artist/peso-pluma"],
    ["pesopluma", "/artist/peso-pluma"],
    ["leninramirez", "/artist/lenin-ramirez"],
    ["netonvega", "/artist/neton-vega"],
    ["Tito Double P", "/artist/tito-double-p"],
    ["Grupo Firme", "/artist/grupo-firme"],
    ["Carín León", "/artist/carin-leon"],
    ["Julio Preciado Y Su Banda Perla Del Pacifico", "/artist/julio-preciado-y-su-banda-perla-del-pacifico"],
  ];

  for (const [input, expected] of cases) assert.equal(canonicalArtistHref(input), expected, input);
});

test("confirmed Banda El Recodo alias redirects without creating a second profile", () => {
  assert.equal(canonicalArtistHref("banda-el-recodo"), "/artist/banda-el-recodo");
  assert.equal(canonicalArtistHref("banda-el-recodo-de-cruz-lizarraga"), "/artist/banda-el-recodo");
  assert.equal(artistCatalogCount, 563);
});

test("unknown URL strings do not create artist records", () => {
  assert.equal(resolveCanonicalArtist("definitely-not-a-real-master-artist"), null);
  assert.equal(canonicalArtistHref("definitely-not-a-real-master-artist"), null);
  assert.equal(resolveCanonicalArtist("bad-%E0%A4%A-url"), null);
});

test("supplemental provider-backed artists resolve to canonical profiles", () => {
  assert.equal(resolveCanonicalArtist("gera-mx")?.name, "Gera MX");
  assert.equal(resolveCanonicalArtist("Jósean Log")?.path, "/artist/josean-log");
  assert.equal(resolveCanonicalArtist("5050 Flow Malandro")?.path, "/artist/5050-flow-malandro");
});
