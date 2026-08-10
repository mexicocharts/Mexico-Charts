import type { RequestHandler } from "express";
import { pool } from "@workspace/db";
import { verifyStripeSignature } from "../lib/stripe-signature";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_accounts (
      clerk_user_id text PRIMARY KEY,
      email text,
      display_name text,
      plan text NOT NULL DEFAULT 'free',
      stripe_customer_id text,
      stripe_subscription_id text,
      subscription_status text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS monitoring_subscriptions (
      stripe_subscription_id text PRIMARY KEY,
      clerk_user_id text NOT NULL,
      artist_key text NOT NULL,
      artist_name text NOT NULL,
      status text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS monitoring_subscriptions_user_idx
      ON monitoring_subscriptions (clerk_user_id, updated_at DESC);
  `);
}

function idOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function refreshAccountPlan(userId: string, customerId = "") {
  const result = await pool.query<{ status: string; stripe_subscription_id: string }>(`
    SELECT status, stripe_subscription_id
    FROM monitoring_subscriptions
    WHERE clerk_user_id = $1
    ORDER BY updated_at DESC
  `, [userId]);
  const active = result.rows.find(row => ACTIVE_STATUSES.has(row.status));
  await pool.query(`
    INSERT INTO user_accounts (clerk_user_id, plan, stripe_customer_id, stripe_subscription_id, subscription_status)
    VALUES ($1, $2, NULLIF($3, ''), $4, $5)
    ON CONFLICT (clerk_user_id) DO UPDATE SET
      plan = EXCLUDED.plan,
      stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, user_accounts.stripe_customer_id),
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      subscription_status = EXCLUDED.subscription_status,
      updated_at = now()
  `, [userId, active ? "paid" : "free", customerId, active?.stripe_subscription_id ?? null, active?.status ?? null]);
}

async function upsertSubscription(input: { subscriptionId: string; userId: string; artistKey: string; artistName: string; status: string; customerId?: string }) {
  if (!input.subscriptionId || !input.userId || !input.artistKey) return;
  await pool.query(`
    INSERT INTO monitoring_subscriptions (stripe_subscription_id, clerk_user_id, artist_key, artist_name, status)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (stripe_subscription_id) DO UPDATE SET
      clerk_user_id = EXCLUDED.clerk_user_id,
      artist_key = EXCLUDED.artist_key,
      artist_name = EXCLUDED.artist_name,
      status = EXCLUDED.status,
      updated_at = now()
  `, [input.subscriptionId, input.userId, input.artistKey, input.artistName || input.artistKey, input.status]);
  await refreshAccountPlan(input.userId, input.customerId);
}

export const stripeWebhookHandler: RequestHandler = async (req, res) => {
  const secret = process.env["STRIPE_WEBHOOK_SECRET"]?.trim() ?? "";
  const signature = req.get("stripe-signature") ?? "";
  const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  if (!secret || !verifyStripeSignature(payload, signature, secret)) {
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }
  try {
    const event = JSON.parse(payload.toString("utf8")) as { type?: string; data?: { object?: Record<string, unknown> } };
    const object = event.data?.object ?? {};
    const metadata = (object["metadata"] && typeof object["metadata"] === "object" ? object["metadata"] : {}) as Record<string, unknown>;
    await ensureTables();
    if (event.type === "checkout.session.completed") {
      await upsertSubscription({
        subscriptionId: idOf(object["subscription"]),
        userId: idOf(object["client_reference_id"]) || idOf(metadata["clerk_user_id"]),
        artistKey: idOf(metadata["artist_key"]),
        artistName: idOf(metadata["artist_name"]),
        status: object["payment_status"] === "paid" ? "active" : "incomplete",
        customerId: idOf(object["customer"]),
      });
    } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await upsertSubscription({
        subscriptionId: idOf(object["id"]),
        userId: idOf(metadata["clerk_user_id"]),
        artistKey: idOf(metadata["artist_key"]),
        artistName: idOf(metadata["artist_name"]),
        status: idOf(object["status"]) || (event.type.endsWith("deleted") ? "canceled" : "incomplete"),
        customerId: idOf(object["customer"]),
      });
    }
    res.json({ received: true });
  } catch (error) {
    req.log.error({ error }, "Stripe monitoring webhook failed");
    res.status(500).json({ error: "Webhook processing failed" });
  }
};
