import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyStripeSignature } from "../lib/stripe-signature";

test("accepts a current valid Stripe webhook signature", () => {
  const payload = Buffer.from('{"id":"evt_test"}');
  const timestamp = 1_700_000_000;
  const signature = createHmac("sha256", "whsec_test").update(`${timestamp}.`).update(payload).digest("hex");
  assert.equal(verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, "whsec_test", timestamp), true);
});

test("rejects altered, malformed, and expired Stripe webhook signatures", () => {
  const payload = Buffer.from('{"id":"evt_test"}');
  const timestamp = 1_700_000_000;
  const signature = createHmac("sha256", "whsec_test").update(`${timestamp}.`).update(payload).digest("hex");
  assert.equal(verifyStripeSignature(Buffer.from("altered"), `t=${timestamp},v1=${signature}`, "whsec_test", timestamp), false);
  assert.equal(verifyStripeSignature(payload, `t=${timestamp},v1=invalid`, "whsec_test", timestamp), false);
  assert.equal(verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, "whsec_test", timestamp + 301), false);
});
