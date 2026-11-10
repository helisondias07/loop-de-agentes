import type { Clock } from "./types.ts";

export const systemClock: Clock = {
  now: () => Date.now(),
};

export function mutableClock(startMs: number): Clock & { set(ms: number): void } {
  let current = startMs;
  return {
    now: () => current,
    set: (ms: number) => {
      current = ms;
    },
  };
}
