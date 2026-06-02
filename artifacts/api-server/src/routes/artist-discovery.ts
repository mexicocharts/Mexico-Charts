import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";

const router = Router();

const VALID_STATUSES = new Set([
  "pending",
  "likely_mexican",
  "needs_review",
  "approved",
  "rejected",
  "linked_existing_artist",
  "not_mexican",
]);

const BULK_STATUSES = new Set(["pending", "needs_review", "rejected"]);

const ADMIN_KEY = () => (
  process.env["NEWSLETTER_ADMIN_KEY"] ||
  process.env["YOUTUBE_ADMIN_KEY"] ||
  process.env["SPOTIFY_ADMIN_KEY"] ||
  ""
).trim();

function requireAdmin(req: Request, res: Response) {
  const expected = ADMIN_KEY();
  const provided = (req.header("x-admin-key") || req.query["adminKey"] || "").toString().trim();
  if (!expected || provided !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function asLimit(value: unknown, fallback = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.floor(parsed), 250));
}

function asOffset(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function asOptionalNumber(value: unknown, min: number, max: number) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(min, Math.min(Math.floor(parsed), max));
}

function sortClause(value: unknown) {
  switch (String(value ?? "")) {
    case "last_seen":
      return "last_seen_date DESC NULLS LAST, confidence_score DESC, artist_name ASC";
    case "first_seen":
      return "first_seen_date DESC NULLS LAST, total_appearances DESC, artist_name ASC";
    case "appearances":
      return "total_appearances DESC, source_count DESC, confidence_score DESC";
    case "source_count":
      return "source_count DESC, total_appearances DESC, confidence_score DESC";
    case "name":
      return "artist_name ASC";
    case "confidence":
    default:
      return "confidence_score DESC, total_appearances DESC, source_count DESC, artist_name ASC";
  }
}

function needsReviewReason(row: {
  status: string;
  confidence_score: number;
  total_appearances: number;
  source_count: number;
  top_sources?: string[] | null;
  positive_signal_count?: number;
  negative_signal_count?: number;
}) {
  if (row.status !== "needs_review") return null;
  if (row.negative_signal_count && row.negative_signal_count > 0) return "Tiene señales negativas o contradictorias.";
  if (!row.positive_signal_count && row.confidence_score >= 55) return "Alta presencia en charts, pero sin evidencia mexicana explícita.";
  if (row.source_count >= 2) return "Aparece en múltiples fuentes y necesita verificación humana.";
  if (row.total_appearances >= 3) return "Aparece repetidamente en charts mexicanos.";
  return "Candidato con señales suficientes para revisión manual.";
}

router.get("/admin/discovery/candidates", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const status = String(req.query["status"] ?? "").trim();
    const source = String(req.query["source"] ?? "").trim();
    const search = String(req.query["search"] ?? "").trim();
    const limit = asLimit(req.query["limit"]);
    const offset = asOffset(req.query["offset"]);
    const minAppearances = asOptionalNumber(req.query["minAppearances"], 0, 10000);
    const confidenceMin = asOptionalNumber(req.query["confidenceMin"], 0, 100);
    const confidenceMax = asOptionalNumber(req.query["confidenceMax"], 0, 100);
    const params: unknown[] = [];
    const filters: string[] = [];

    if (status) {
      if (!VALID_STATUSES.has(status)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      params.push(status);
      filters.push(`status = $${params.length}`);
    }
    if (source) {
      params.push(source);
      filters.push(`EXISTS (
        SELECT 1
        FROM artist_candidate_events source_filter
        WHERE source_filter.candidate_id = artist_candidates.id
          AND source_filter.source = $${params.length}
      )`);
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      filters.push(`LOWER(artist_name) LIKE $${params.length}`);
    }
    if (minAppearances != null) {
      params.push(minAppearances);
      filters.push(`total_appearances >= $${params.length}`);
    }
    if (confidenceMin != null) {
      params.push(confidenceMin);
      filters.push(`confidence_score >= $${params.length}`);
    }
    if (confidenceMax != null) {
      params.push(confidenceMax);
      filters.push(`confidence_score <= $${params.length}`);
    }

    params.push(limit, offset);
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const order = sortClause(req.query["sort"]);

    const [candidates, counts, sources] = await Promise.all([
      pool.query(
        `
          SELECT
            id,
            artist_name,
            normalized_name,
            status,
            confidence_score,
            first_seen_date,
            last_seen_date,
            total_appearances,
            source_count,
            notes,
            matched_artist_id,
            created_at,
            updated_at,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object('source', ranked.source, 'count', ranked.event_count) ORDER BY ranked.event_count DESC, ranked.source ASC)
              FROM (
                SELECT source, COUNT(*)::integer AS event_count
                FROM artist_candidate_events
                WHERE candidate_id = artist_candidates.id
                GROUP BY source
                ORDER BY event_count DESC, source ASC
                LIMIT 5
              ) ranked
            ), '[]'::jsonb) AS top_sources,
            COALESCE((
              SELECT COUNT(*)::integer
              FROM artist_candidate_signals
              WHERE candidate_id = artist_candidates.id
                AND confidence_weight >= 25
                AND signal_type <> 'chart_presence'
            ), 0) AS positive_signal_count,
            COALESCE((
              SELECT COUNT(*)::integer
              FROM artist_candidate_signals
              WHERE candidate_id = artist_candidates.id
                AND confidence_weight < 0
            ), 0) AS negative_signal_count
          FROM artist_candidates
          ${where}
          ORDER BY ${order}
          LIMIT $${params.length - 1}
          OFFSET $${params.length};
        `,
        params,
      ),
      pool.query(
        `
          SELECT status, COUNT(*)::integer AS count
          FROM artist_candidates
          GROUP BY status
          ORDER BY status;
        `,
      ),
      pool.query(
        `
          SELECT source, COUNT(DISTINCT candidate_id)::integer AS count
          FROM artist_candidate_events
          GROUP BY source
          ORDER BY count DESC, source ASC;
        `,
      ),
    ]);
    const candidatesWithReasons = candidates.rows.map(row => ({
      ...row,
      needs_review_reason: needsReviewReason(row as Parameters<typeof needsReviewReason>[0]),
    }));

    res.json({
      candidates: candidatesWithReasons,
      counts: counts.rows,
      sources: sources.rows,
      limit,
      offset,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not load discovery candidates", detail: String(err) });
  }
});

router.get("/admin/discovery/candidates/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid candidate id" });
      return;
    }

    const [candidate, events, signals, topSources] = await Promise.all([
      pool.query(
        `
          SELECT
            *,
            COALESCE((
              SELECT COUNT(*)::integer
              FROM artist_candidate_signals
              WHERE candidate_id = artist_candidates.id
                AND confidence_weight >= 25
                AND signal_type <> 'chart_presence'
            ), 0) AS positive_signal_count,
            COALESCE((
              SELECT COUNT(*)::integer
              FROM artist_candidate_signals
              WHERE candidate_id = artist_candidates.id
                AND confidence_weight < 0
            ), 0) AS negative_signal_count
          FROM artist_candidates
          WHERE id = $1;
        `,
        [id],
      ),
      pool.query(
        `
          SELECT *
          FROM artist_candidate_events
          WHERE candidate_id = $1
          ORDER BY chart_date DESC, source ASC, chart_type ASC, rank ASC NULLS LAST
          LIMIT 100;
        `,
        [id],
      ),
      pool.query(
        `
          SELECT *
          FROM artist_candidate_signals
          WHERE candidate_id = $1
          ORDER BY confidence_weight DESC, created_at DESC;
        `,
        [id],
      ),
      pool.query(
        `
          SELECT source, COUNT(*)::integer AS count
          FROM artist_candidate_events
          WHERE candidate_id = $1
          GROUP BY source
          ORDER BY count DESC, source ASC;
        `,
        [id],
      ),
    ]);

    if (!candidate.rows[0]) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }

    const candidateRow = candidate.rows[0] as Parameters<typeof needsReviewReason>[0];
    res.json({
      candidate: {
        ...candidate.rows[0],
        needs_review_reason: needsReviewReason(candidateRow),
      },
      events: events.rows,
      recentAppearances: events.rows.slice(0, 15),
      signals: signals.rows,
      topSources: topSources.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not load discovery candidate", detail: String(err) });
  }
});

router.post("/admin/discovery/candidates/bulk-status", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0)
      : [];
    const status = String(req.body?.status ?? "").trim();
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : null;

    if (!ids.length || !BULK_STATUSES.has(status)) {
      res.status(400).json({ error: "Invalid bulk status payload" });
      return;
    }

    const result = await pool.query(
      `
        UPDATE artist_candidates
        SET status = $2,
            notes = COALESCE($3, notes),
            updated_at = now()
        WHERE id = ANY($1::integer[])
        RETURNING *;
      `,
      [ids, status, notes],
    );

    res.json({ updated: result.rows.length, candidates: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Could not bulk update discovery candidates", detail: String(err) });
  }
});

router.post("/admin/discovery/candidates/:id/status", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const id = Number(req.params["id"]);
    const status = String(req.body?.status ?? "").trim();
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : null;

    if (!Number.isFinite(id) || !VALID_STATUSES.has(status)) {
      res.status(400).json({ error: "Invalid candidate id or status" });
      return;
    }

    const result = await pool.query(
      `
        UPDATE artist_candidates
        SET status = $2,
            notes = COALESCE($3, notes),
            updated_at = now()
        WHERE id = $1
        RETURNING *;
      `,
      [id, status, notes],
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }

    res.json({ candidate: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Could not update discovery candidate", detail: String(err) });
  }
});

router.post("/admin/discovery/candidates/:id/link-existing", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const id = Number(req.params["id"]);
    const artistKey = String(req.body?.artistKey ?? req.body?.matchedArtistId ?? "").trim().toLowerCase();
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : null;

    if (!Number.isFinite(id) || !artistKey) {
      res.status(400).json({ error: "Invalid candidate id or artistKey" });
      return;
    }

    const result = await pool.query(
      `
        UPDATE artist_candidates
        SET status = 'linked_existing_artist',
            matched_artist_id = $2,
            notes = COALESCE($3, notes),
            updated_at = now()
        WHERE id = $1
        RETURNING *;
      `,
      [id, artistKey, notes],
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }

    res.json({ candidate: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Could not link discovery candidate", detail: String(err) });
  }
});

router.post("/admin/discovery/candidates/:id/signals", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const id = Number(req.params["id"]);
    const signalType = String(req.body?.signalType ?? "").trim();
    const source = String(req.body?.source ?? "").trim();
    const value = String(req.body?.value ?? "").trim();
    const confidenceWeight = Math.max(-100, Math.min(Number(req.body?.confidenceWeight ?? 0), 100));

    if (!Number.isFinite(id) || !signalType || !source || !value || !Number.isFinite(confidenceWeight)) {
      res.status(400).json({ error: "Invalid signal payload" });
      return;
    }

    const candidate = await pool.query("SELECT id FROM artist_candidates WHERE id = $1;", [id]);
    if (!candidate.rows[0]) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }

    const result = await pool.query(
      `
        INSERT INTO artist_candidate_signals (
          candidate_id,
          signal_type,
          source,
          value,
          confidence_weight
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (candidate_id, signal_type, source, value)
        DO UPDATE SET confidence_weight = EXCLUDED.confidence_weight
        RETURNING *;
      `,
      [id, signalType, source, value, confidenceWeight],
    );

    res.json({ signal: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Could not add discovery signal", detail: String(err) });
  }
});

export default router;
