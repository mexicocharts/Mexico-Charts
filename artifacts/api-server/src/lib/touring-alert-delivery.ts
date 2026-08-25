import { pool } from "@workspace/db";
import { logger } from "./logger";

const CHECK_MS = 15 * 60 * 1000;
let started = false;

function configured() {
  return Boolean(process.env["RESEND_API_KEY"]?.trim() && process.env["RESEND_FROM_EMAIL"]?.trim());
}

async function recipients(artistId: string | null, alertType: string) {
  const newsletter = await pool.query<{ email: string }>(`SELECT email FROM newsletter_subscribers
    WHERE status='active' AND source='touring'`);
  const watched = artistId ? await pool.query<{ email: string }>(`SELECT DISTINCT u.email FROM touring_watchlists w
    JOIN user_accounts u ON u.clerk_user_id=w.clerk_user_id WHERE w.artist_id=$1 AND w.urgent_alerts=true
    AND w.announcement_alerts=true AND u.email IS NOT NULL`, [artistId])
    : alertType === "weekly_summary" ? await pool.query<{ email: string }>(`SELECT DISTINCT u.email FROM touring_watchlists w
      JOIN user_accounts u ON u.clerk_user_id=w.clerk_user_id WHERE w.daily_digest=true AND u.email IS NOT NULL`)
      : { rows: [] as { email: string }[] };
  return [...new Set([...newsletter.rows,...watched.rows].map(row => row.email.trim().toLowerCase()).filter(Boolean))];
}

async function sendEmail(to: string, subject: string, message: string, sourceUrl: string | null) {
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: {
    Authorization: `Bearer ${process.env["RESEND_API_KEY"]!.trim()}`, "Content-Type": "application/json",
  }, body: JSON.stringify({
    from: process.env["RESEND_FROM_EMAIL"]!.trim(), to: [to], subject,
    text: `${message}\n\n${sourceUrl ? `Fuente oficial: ${sourceUrl}\n\n` : ""}Mexico Charts Touring — https://mexicochart.com/touring`,
    headers: { "List-Unsubscribe": `<mailto:${process.env["RESEND_UNSUBSCRIBE_EMAIL"]?.trim() || "unsubscribe@mexicochart.com"}?subject=unsubscribe>` },
  }), signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Resend HTTP ${response.status}: ${(await response.text()).slice(0,300)}`);
}

export async function runTouringAlertDelivery() {
  if (!configured()) return { status: "disabled", reason: "missing_resend_configuration" } as const;
  const outbox = await pool.query<{ id: string; artist_id: string | null; alert_type: string; dedupe_key: string; title: string; message: string; source_url: string | null }>(
    `SELECT id,artist_id,alert_type,dedupe_key,title,message,source_url FROM touring_alert_outbox WHERE status='pending' AND available_at<=now()
     ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED`,
  );
  let sent = 0, failed = 0;
  for (const alert of outbox.rows) {
    try {
       const emails = await recipients(alert.artist_id, alert.alert_type);
      for (const email of emails) await sendEmail(email,alert.title,alert.message,alert.source_url);
       await pool.query(`UPDATE touring_alert_outbox SET status='sent',sent_at=now(),attempts=attempts+1,
         recipient_count=$2,last_attempt_at=now(),last_error=NULL,updated_at=now() WHERE id=$1`, [alert.id, emails.length]);
       if (alert.alert_type === "weekly_summary") await pool.query(`UPDATE touring_weekly_summaries
         SET delivery_status='sent',delivered_at=now(),last_error=NULL WHERE week_start=to_date($1,'IYYY-"W"IW')`, [alert.dedupe_key.replace("touring-weekly-summary:", "")]);
      sent += 1;
    } catch (error) {
      failed += 1;
       await pool.query(`UPDATE touring_alert_outbox SET status=CASE WHEN attempts+1>=5 THEN 'failed' ELSE 'pending' END,
         attempts=attempts+1,last_attempt_at=now(),last_error=$2,
        available_at=now()+make_interval(mins=>LEAST(360,(attempts+1)*30)),updated_at=now() WHERE id=$1`,
        [alert.id,error instanceof Error ? error.message.slice(0,500) : "Unknown delivery error"]);
       if (alert.alert_type === "weekly_summary") await pool.query(`UPDATE touring_weekly_summaries
         SET delivery_status=CASE WHEN (SELECT attempts FROM touring_alert_outbox WHERE id=$1)>=5 THEN 'failed' ELSE 'retrying' END,
         last_error=$2 WHERE week_start=to_date($3,'IYYY-"W"IW')`, [alert.id,error instanceof Error ? error.message.slice(0,500) : "Unknown delivery error", alert.dedupe_key.replace("touring-weekly-summary:", "")]);
    }
  }
  return { status: "complete", alerts: outbox.rowCount, sent, failed } as const;
}

async function check() {
  try { const result=await runTouringAlertDelivery(); if(result.status!=="disabled") logger.info(result,"[touring-alerts] delivery complete"); }
  catch(error) { logger.error({ error },"[touring-alerts] delivery failed"); }
}

export function startTouringAlertDelivery() {
  if (started) return;
  started=true;
  setTimeout(()=>void check(),90_000);
  const timer=setInterval(()=>void check(),CHECK_MS);timer.unref();
}
