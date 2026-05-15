import { useState, useEffect, useRef } from "react";

export type AnimPhase = "intro" | "stagger" | "hold" | "outro";

// Default phase durations (ms) — total 8500ms, within required 8-10s range
const DEFAULT_INTRO_MS   = 300;
const DEFAULT_STAGGER_MS = 2200;
const DEFAULT_HOLD_MS    = 4800;
const DEFAULT_OUTRO_MS   = 1200;
const DEFAULT_TOTAL_MS   = DEFAULT_INTRO_MS + DEFAULT_STAGGER_MS + DEFAULT_HOLD_MS + DEFAULT_OUTRO_MS;

/**
 * Drives a looping animation cycle through intro → stagger → hold → outro phases.
 * @param durationMs  Optional total cycle length in ms. Defaults to 8500ms.
 *                    Phase proportions are preserved when overriding duration.
 */
export function useAnimLoop(durationMs?: number): { phase: AnimPhase; cycle: number } {
  const total   = durationMs ?? DEFAULT_TOTAL_MS;
  const ratio   = total / DEFAULT_TOTAL_MS;
  const introMs   = Math.round(DEFAULT_INTRO_MS   * ratio);
  const staggerMs = Math.round(DEFAULT_STAGGER_MS * ratio);
  const holdMs    = Math.round(DEFAULT_HOLD_MS    * ratio);

  const [phase, setPhase] = useState<AnimPhase>("intro");
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    let t3: ReturnType<typeof setTimeout>;
    let t4: ReturnType<typeof setTimeout>;

    function run() {
      setPhase("intro");
      t1 = setTimeout(() => setPhase("stagger"), introMs);
      t2 = setTimeout(() => setPhase("hold"),    introMs + staggerMs);
      t3 = setTimeout(() => setPhase("outro"),   introMs + staggerMs + holdMs);
      t4 = setTimeout(() => { setCycle(c => c + 1); run(); }, total);
    }

    run();
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  return { phase, cycle };
}

/**
 * Animates an array of numeric targets from 0 → target over ~900ms using rAF.
 * Starts/resets when `active` changes or `resetKey` changes (new loop cycle).
 * Returns 0 for all values when inactive.
 */
export function useStreamCounters(
  targets: number[],
  active: boolean,
  resetKey: number | string,
): number[] {
  const [counts, setCounts] = useState<number[]>(() => targets.map(() => 0));
  const rafRef = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!active || targets.length === 0) {
      setCounts(targets.map(() => 0));
      return;
    }
    const DURATION = 900;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCounts(targets.map(t => Math.round(t * eased)));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, resetKey]);

  return counts;
}
