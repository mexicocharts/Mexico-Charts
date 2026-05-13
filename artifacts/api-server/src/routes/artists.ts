import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const METADATA_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata";

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/* ── Subgenre fallback (mirrors web artistMetadata.ts SUBGENRE_BY_KEY) ────────
   Applied when the sheet's subgenre column is blank.
   Sheet value always wins — this is only a fallback.
───────────────────────────────────────────────────────────────────────────── */
const SUBGENRE_BY_KEY: Record<string, string> = {
  /* Corridos Tumbados */
  "fuerza regida":                          "corridos tumbados",
  "peso pluma":                             "corridos tumbados",
  "junior h":                               "corridos tumbados",
  "neton vega":                             "corridos tumbados",
  "tito double p":                          "corridos tumbados",
  "el bogueto":                             "corridos tumbados",
  "oscar maydon":                           "corridos tumbados",
  "natanael cano":                          "corridos tumbados",
  "luis r conriquez":                       "corridos tumbados",
  "gabito ballesteros":                     "corridos tumbados",
  "calle 24":                               "corridos tumbados",
  "chino pacas":                            "corridos tumbados",
  "chuyin":                                 "corridos tumbados",
  "virlan garcia":                          "corridos tumbados",
  "gael valenzuela":                        "corridos tumbados",
  "emmanuellcortess":                       "corridos tumbados",
  "jasiel nunez":                           "corridos tumbados",
  "jorsshh":                                "corridos tumbados",
  "lencho":                                 "corridos tumbados",
  "los dos de tamaulipas":                  "corridos tumbados",
  "jr torres":                              "corridos tumbados",
  "ian cordova":                            "corridos tumbados",
  "el fantasma":                            "corridos tumbados",
  "estevan plazola":                        "corridos tumbados",
  "panter belico":                          "corridos tumbados",
  "el de las r s":                          "corridos tumbados",
  "gerardo coronel":                        "corridos tumbados",
  "esau ortiz":                             "corridos tumbados",
  "kane rodriguez":                         "corridos tumbados",
  "codiciado":                              "corridos tumbados",
  "los alegres del barranco":               "corridos tumbados",
  "dannylux":                               "corridos tumbados",
  "codigo fn":                              "corridos tumbados",
  "moy bobadilla":                          "corridos tumbados",
  "los dos carnales":                       "corridos tumbados",
  "grupo arriesgado":                       "corridos tumbados",

  /* Regional Mexicano */
  "grupo frontera":                         "regional mexicano",
  "carin leon":                             "regional mexicano",
  "christian nodal":                        "regional mexicano",
  "xavi":                                   "regional mexicano",
  "grupo firme":                            "regional mexicano",
  "victor mendivil":                        "regional mexicano",
  "grupo marca registrada":                 "regional mexicano",
  "alejandro fernandez":                    "regional mexicano",
  "lenin ramirez":                          "regional mexicano",
  "joan sebastian":                         "regional mexicano",
  "eslabon armado":                         "regional mexicano",
  "eden munoz":                             "regional mexicano",
  "los dareyes de la sierra":               "regional mexicano",
  "alfredo olivas":                         "regional mexicano",
  "vicente fernandez":                      "regional mexicano",
  "herencia de grandes":                    "regional mexicano",
  "omar camacho":                           "regional mexicano",
  "edgardo nunez":                          "regional mexicano",
  "juan gabriel":                           "regional mexicano",
  "clave especial":                         "regional mexicano",
  "los angeles azules":                     "regional mexicano",
  "gerardo ortiz":                          "regional mexicano",
  "yahritza y su esencia":                  "regional mexicano",
  "la adictiva":                            "regional mexicano",
  "los plebes del rancho de ariel camacho": "regional mexicano",
  "los bukis":                              "regional mexicano",
  "espinoza paz":                           "regional mexicano",
  "pepe aguilar":                           "regional mexicano",
  "ariel camacho y los plebes del rancho":  "regional mexicano",
  "ivan cornejo":                           "regional mexicano",
  "los temrarios":                          "regional mexicano",
  "bronco":                                 "regional mexicano",
  "el chapo de sinaloa":                    "regional mexicano",
  "edicion especial":                       "regional mexicano",
  "jr":                                     "regional mexicano",
  "grupo mojado":                           "regional mexicano",
  "valentin elizalde":                      "regional mexicano",
  "el komander":                            "regional mexicano",
  "sergio vega el shaka":                   "regional mexicano",
  "t3r elemento":                           "regional mexicano",
  "angela aguilar":                         "regional mexicano",
  "grupo canaveral":                        "regional mexicano",
  "chalino sanchez":                        "regional mexicano",
  "pancho barraza":                         "regional mexicano",
  "los angeles de charly":                  "regional mexicano",
  "el bebeto":                              "regional mexicano",
  "luis mexia":                             "regional mexicano",
  "grupo bryndis":                          "regional mexicano",
  "los gemelos de sinaloa":                 "regional mexicano",
  "regulo molina":                          "regional mexicano",
  "edwin luna y la trakalosa de monterrey": "regional mexicano",
  "ana gabriel":                            "regional mexicano",

  /* Norteño */
  "julion alvarez and su norteno banda":    "norteño",
  "calibre 50":                             "norteño",
  "los tigres del norte":                   "norteño",
  "los tucanes de tijuana":                 "norteño",
  "conjunto primavera":                     "norteño",
  "pesado":                                 "norteño",
  "los invasores de nuevo leon":            "norteño",
  "cardenales de nuevo leon":               "norteño",
  "bobby pulido":                           "norteño",
  "el duelo":                               "norteño",
  "intocable":                              "norteño",
  "hermanos espinoza":                      "norteño",

  /* Banda */
  "banda ms de sergio lizarraga":           "banda",
  "la arrolladora banda el limon":          "banda",
  "banda el recodo":                        "banda",
  "banda el recodo de cruz lizarraga":      "banda",
  "banda los recoditos":                    "banda",
  "el coyote y su banda tierra santa":      "banda",
  "remmy valenzuela":                       "banda",

  /* Hip-Hop */
  "yng lvcas":                              "hip-hop",
  "el malilla":                             "hip-hop",

  /* Pop */
  "luis miguel":                            "pop",
  "reik":                                   "pop",
  "marco antonio solis":                    "pop",
  "julieta venegas":                        "pop",
  "mon laferte":                            "pop",
  "jesse and joy":                          "pop",
  "cristian castro":                        "pop",
  "jose jose":                              "pop",
  "camila":                                 "pop",
  "belinda":                                "pop",
  "selena":                                 "pop",
  "belanova":                               "pop",
  "carla morrison":                         "pop",
  "thalia":                                 "pop",
  "ha ash":                                 "pop",
  "emmanuel":                               "pop",
  "gloria trevi":                           "pop",
  "sin bandera":                            "pop",
  "yurdia":                                 "pop",
  "kenia os":                               "pop",
  "humbe":                                  "pop",
  "diego verdaguer":                        "pop",
  "paulina rubio":                          "pop",
  "reyli barba":                            "pop",
  "alan arrieta":                           "pop",
  "kevin amf":                              "pop",
  "amanda miguel":                          "pop",
  "hupe$":                                  "pop",
  "angel almaguer":                         "pop",
  "yeri mua":                               "pop",
  "carlos rivera":                          "pop",
  "alejandra guzman":                       "pop",
  "marisela":                               "pop",
  "becky g":                                "pop",
  "bellakath":                              "pop",
  "armenta":                                "pop",
};

interface CacheSlot {
  rows: Record<string, string>[];
  fetchedAt: number;
}
let cache: CacheSlot | null = null;

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return { headers: [], rows: [] };

  function splitRow(line: string): string[] {
    const fields: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        fields.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur);
    return fields;
  }

  const headers = splitRow(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitRow(lines[i]);
    if (vals.every((v) => !v.trim())) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] ?? "").trim(); });
    rows.push(row);
  }
  return { headers, rows };
}

function applySubgenreFallback(row: Record<string, string>): Record<string, string> {
  const existing = row.subgenre?.trim() ?? "";
  if (existing) return row; // sheet value wins

  const artistKey = (row.artist_key?.trim() || row.artist_name?.trim() || "").toLowerCase();
  const fallback = SUBGENRE_BY_KEY[artistKey] ?? "";
  if (!fallback) return row;

  return { ...row, subgenre: fallback };
}

/* Strip stray quote characters that Google Sheets CSV export sometimes leaves
   at the start or end of field values (e.g. `Sergio Vega El Shaka""` → `Sergio Vega El Shaka`). */
function sanitizeRow(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v.replace(/^"+|"+$/g, "").trim();
  }
  return out;
}

async function fetchMetadata(): Promise<Record<string, string>[]> {
  const resp = await fetch(METADATA_URL, { signal: AbortSignal.timeout(15000) });
  if (!resp.ok) throw new Error(`artist_metadata: HTTP ${resp.status}`);
  const { rows } = parseCSV(await resp.text());
  return rows.map(sanitizeRow).map(applySubgenreFallback);
}

router.get("/artists/metadata", async (_req, res) => {
  try {
    if (!cache || Date.now() - cache.fetchedAt > CACHE_TTL) {
      try {
        const rows = await fetchMetadata();
        cache = { rows, fetchedAt: Date.now() };
        logger.info({ count: rows.length }, "[artists] metadata refreshed");
      } catch (err) {
        if (cache) {
          res.setHeader("X-Cache-Stale", "true");
          logger.warn({ err }, "[artists] metadata refresh failed, serving stale cache");
        } else {
          throw err;
        }
      }
    }
    res.setHeader("Cache-Control", "public, max-age=600, stale-while-revalidate=3600");
    res.json({ artists: cache!.rows, fetchedAt: cache!.fetchedAt });
  } catch (err) {
    logger.error({ err }, "[artists] metadata unavailable");
    res.status(502).json({ error: "Artist metadata unavailable", detail: String(err) });
  }
});

export default router;
