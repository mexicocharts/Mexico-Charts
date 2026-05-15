import { useState, useEffect, useRef } from "react";

export type AnimPhase = "intro" | "stagger" | "hold" | "outro";

const INTRO_MS   = 300;
const STAGGER_MS = 2200;
const HOLD_MS    = 2800;
const OUTRO_MS   = 1200;
const TOTAL_MS   = INTRO_MS + STAGGER_MS + HOLD_MS + OUTRO_MS; // 6500ms

export function useAnimLoop(): { phase: AnimPhase; cycle: number } {
  const [phase, setPhase] = useState<AnimPhase>("intro");
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    let t3: ReturnType<typeof setTimeout>;
    let t4: ReturnType<typeof setTimeout>;

    function run() {
      setPhase("intro");
      t1 = setTimeout(() => setPhase("stagger"), INTRO_MS);
      t2 = setTimeout(() => setPhase("hold"),    INTRO_MS + STAGGER_MS);
      t3 = setTimeout(() => setPhase("outro"),   INTRO_MS + STAGGER_MS + HOLD_MS);
      t4 = setTimeout(() => { setCycle(c => c + 1); run(); }, TOTAL_MS);
    }

    run();
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  return { phase, cycle };
}

/**
 * Animates an array of numeric targets from 0 → target over ~900ms using rAF.
 * - Starts/resets when `active` changes or `resetKey` changes (e.g. a new loop cycle).
 * - Returns 0 for all values when inactive.
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
