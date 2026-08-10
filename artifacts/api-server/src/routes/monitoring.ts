import { Router } from "express";
import { listSongstatsCatalogArtists } from "../lib/songstats-snapshot-service";
import {
  auditMonitoringReadiness,
  getMonitoringReadyArtist,
} from "../lib/monitoring-readiness-service";
import { logger } from "../lib/logger";
import { clerkConfigured, clerkUserId, requireClerkUser } from "../lib/auth";

const router = Router();
const PRICE_USD_CENTS = 600;

function siteOrigin(): string {
  return (process.env["PUBLIC_SITE_URL"] ?? "https://mexicochart.com").replace(/\/$/, "");
}

function stripeSecret(): string {
  return (process.env["STRIPE_SECRET_KEY"] ?? "").trim();
}

function paidMonitoringEnabled(): boolean {
  return process.env["PAID_MONITORING_ENABLED"]?.trim().toLowerCase() === "true";
}

function safeLanguage(raw: unknown): "es" | "en" {
  return String(raw ?? "es").toLowerCase() === "en" ? "en" : "es";
}

router.get("/monitoring/config", (_req, res) => {
  res.json({
    checkoutEnabled: paidMonitoringEnabled() && Boolean(stripeSecret()) && clerkConfigured(),
    accountsEnabled: clerkConfigured(),
    priceUsdCents: PRICE_USD_CENTS,
    delivery: "daily_dashboard_monthly_report",
  });
});

router.get("/monitoring/artists", async (_req, res) => {
  try {
    const audit = await auditMonitoringReadiness({ readyOnly: true });
    res.json({
      policyVersion: audit.policyVersion,
      count: audit.ready.length,
      artists: audit.ready.map(artist => ({
        artistKey: artist.artistKey,
        artistName: artist.artistName,
        matchKeys: artist.matchKeys,
      })),
    });
  } catch (error) {
    logger.error({ error }, "Monitoring artist availability failed");
    res.status(503).json({ error: "Monitoring availability is temporarily unavailable" });
  }
});

router.post("/monitoring/checkout", requireClerkUser, async (req, res) => {
  const artistKey = String(req.body?.artistKey ?? "").trim().toLowerCase();
  const requestedName = String(req.body?.artistName ?? "").trim();
  const language = safeLanguage(req.body?.language);
  const secret = stripeSecret();
  const userId = clerkUserId(res);

  if (!paidMonitoringEnabled()) {
    res.status(503).json({
      error: "Paid monitoring is not available yet",
      code: "paid_monitoring_disabled",
    });
    return;
  }

  if (!secret) {
    res.status(503).json({
      error: "Payments are not configured yet",
      code: "payments_not_configured",
    });
    return;
  }
  if (!artistKey || artistKey.length > 160) {
    res.status(400).json({ error: "A valid artistKey is required" });
    return;
  }

  try {
    const [catalogArtist] = await listSongstatsCatalogArtists({
      limit: 1,
      artistKeys: [artistKey],
    });
    if (!catalogArtist) {
      res.status(404).json({ error: "Artist is not available for monitoring" });
      return;
    }
    const readyArtist = await getMonitoringReadyArtist(catalogArtist.artistKey);
    if (!readyArtist) {
      res.status(409).json({
        error: "This artist does not currently meet the complete monitoring-data standard",
        code: "monitoring_not_ready",
      });
      return;
    }

    const artistName = catalogArtist.spotifyName?.trim() || requestedName || artistKey;
    const origin = siteOrigin();
    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("success_url", `${origin}/monitoreo/exito?session_id={CHECKOUT_SESSION_ID}&lang=${language}`);
    params.set("cancel_url", `${origin}/monitoreo?artist=${encodeURIComponent(artistKey)}&lang=${language}`);
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][unit_amount]", String(PRICE_USD_CENTS));
    params.set("line_items[0][price_data][recurring][interval]", "month");
    params.set("line_items[0][price_data][product_data][name]", `Mexico Charts — ${artistName}`);
    params.set(
      "line_items[0][price_data][product_data][description]",
      language === "en"
        ? "Daily artist dashboard with permanent streaming history and a monthly report"
        : "Panel diario del artista con historial permanente de streaming y reporte mensual",
    );
    params.set("metadata[artist_key]", catalogArtist.artistKey);
    params.set("metadata[artist_name]", artistName);
    params.set("metadata[product]", "artist_monitoring");
    params.set("metadata[clerk_user_id]", userId);
    params.set("client_reference_id", userId);
    params.set("subscription_data[metadata][artist_key]", catalogArtist.artistKey);
    params.set("subscription_data[metadata][artist_name]", artistName);
    params.set("subscription_data[metadata][product]", "artist_monitoring");
    params.set("subscription_data[metadata][clerk_user_id]", userId);

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const payload = await stripeResponse.json() as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };
    if (!stripeResponse.ok || !payload.url) {
      logger.error({
        status: stripeResponse.status,
        message: payload.error?.message,
        artistKey: catalogArtist.artistKey,
      }, "Stripe monitoring checkout creation failed");
      res.status(502).json({ error: "Unable to start secure checkout" });
      return;
    }

    res.json({ checkoutUrl: payload.url });
  } catch (error) {
    logger.error({ error, artistKey }, "Monitoring checkout failed");
    res.status(500).json({ error: "Unable to start monitoring checkout" });
  }
});

export default router;
