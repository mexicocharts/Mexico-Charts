import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyStripeSignature(payload: Buffer, header: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const fields = header.split(",").map(part => part.trim().split("=", 2));
  const timestamp = fields.find(([key]) => key === "t")?.[1] ?? "";
  const signatures = fields.filter(([key]) => key === "v1").map(([, value]) => value ?? "");
  if (!/^\d+$/.test(timestamp) || Math.abs(nowSeconds - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(payload).digest();
  return signatures.some(signature => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const candidate = Buffer.from(signature, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}
