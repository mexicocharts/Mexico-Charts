import assert from "node:assert/strict";
import test from "node:test";

import { connectWithBoundedRetry } from "./youtube-validation-connection";

test("retries a transient connection failure without changing the scheduled run", async () => {
  let attempts = 0;
  const delays: number[] = [];
  const failures: Array<{ attempt: number; retryDelayMs: number | null }> = [];

  const client = await connectWithBoundedRetry({
    connect: async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("transient connection failure");
      return { connected: true };
    },
    maxAttempts: 3,
    retryDelayMs: attempt => attempt * 5_000,
    sleep: async milliseconds => { delays.push(milliseconds); },
    onFailedAttempt: details => {
      failures.push({ attempt: details.attempt, retryDelayMs: details.retryDelayMs });
    },
  });

  assert.deepEqual(client, { connected: true });
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [5_000, 10_000]);
  assert.deepEqual(failures, [
    { attempt: 1, retryDelayMs: 5_000 },
    { attempt: 2, retryDelayMs: 10_000 },
  ]);
});

test("fails after the bounded attempt count and records the terminal failure", async () => {
  const failures: Array<{ attempt: number; retryDelayMs: number | null }> = [];

  await assert.rejects(
    connectWithBoundedRetry({
      connect: async () => { throw new Error("database unavailable"); },
      maxAttempts: 2,
      retryDelayMs: () => 1,
      sleep: async () => {},
      onFailedAttempt: details => {
        failures.push({ attempt: details.attempt, retryDelayMs: details.retryDelayMs });
      },
    }),
    /database unavailable/,
  );

  assert.deepEqual(failures, [
    { attempt: 1, retryDelayMs: 1 },
    { attempt: 2, retryDelayMs: null },
  ]);
});
