import { useState, useEffect } from "react";

export type AnimPhase = "intro" | "stagger" | "hold" | "outro";

const INTRO_MS  =  500;
const STAGGER_MS = 2000;
const HOLD_MS   = 3500;
const OUTRO_MS  =  900;
const TOTAL_MS  = INTRO_MS + STAGGER_MS + HOLD_MS + OUTRO_MS;

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
