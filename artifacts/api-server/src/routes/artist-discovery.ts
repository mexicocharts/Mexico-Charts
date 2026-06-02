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

function sortClause(value: unknown) {
  switch (String(value ?? "")) {
    case "recent":
      return "last_seen_date DESC NULLS LAST, confidence_score DESC, artist_name ASC";
    case "oldest":
      return "first_seen_date ASC NULLS LAST, artist_name ASC";
    case "appearances":
      return "total_appearances DESC, source_count DESC, confidence_score DESC";
    case "name":
      return "artist_name ASC";
    case "confidence":
    default:
      return "confidence_score DESC, total_appearances DESC, source_count DESC, artist_name ASC";
  }
}

router.get("/admin/discovery/candidates", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const status = String(req.query["status"] ?? "").trim();
    const limit = asLimit(req.query["limit"]);
    const offset = asOffset(req.query["offset"]);
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

    params.push(limit, offset);
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const order = sortClause(req.query["sort"]);

    const [candidates, counts] = await Promise.all([
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
            updated_at
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
    ]);

    res.json({
      candidates: candidates.rows,
      counts: counts.rows,
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

    const [candidate, events, signals] = await Promise.all([
      pool.query("SELECT * FROM artist_candidates WHERE id = $1;", [id]),
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
    ]);

    if (!candidate.rows[0]) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }

    res.json({
      candidate: candidate.rows[0],
      events: events.rows,
      signals: signals.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not load discovery candidate", detail: String(err) });
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
