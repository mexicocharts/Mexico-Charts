import {
  replaceInvalidYoutubeValidationSession,
  runYoutubeValidationComparatorSweep,
} from "../lib/youtube-authorized-live-validation";

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}

const action = argument("action");

if (action === "preflight") {
  const limit = Math.max(1, Math.min(100, Number(argument("limit") ?? "25") || 25));
  const result = await runYoutubeValidationComparatorSweep("manual-preflight", limit);
  console.log(JSON.stringify(result));
  if (result.status === "skipped") process.exitCode = 2;
} else if (action === "start") {
  const expectedSessionId = argument("expected-session");
  if (!expectedSessionId) throw new Error("--expected-session is required for --action=start.");
  const result = await replaceInvalidYoutubeValidationSession({
    expectedSessionId,
    reason: "Comparator discovery was not continuously invoked; preserved as non-decision evidence.",
  });
  console.log(JSON.stringify(result));
} else {
  throw new Error("Use --action=preflight [--limit=25] or --action=start --expected-session=<id>.");
}
