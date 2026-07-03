/**
 * Tier-response curves — the mapping from slider intensity (0..1) to each
 * effect's weight. Curve choice is what makes tiers feel qualitatively
 * different (spec §3): `late` params are invisible until Strong, `early`
 * ones carry Threshold/Light.
 */

export type CurveName = 'early' | 'smooth' | 'late' | 'spike' | 'none';

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Stateless curves. */
export function evalCurve(curve: CurveName, x: number): number {
  const t = Math.min(1, Math.max(0, x));
  switch (curve) {
    case 'early':  return Math.sqrt(t);
    case 'smooth': return smoothstep(0.08, 0.92, t);
    case 'late':   return t * t * t;
    case 'spike':  return t; // envelope applied by SpikeState per frame
    case 'none':   return 0;
  }
}

/**
 * `spike` params burst on stochastically: value = curve(x) only during short
 * bursts whose probability and length grow with intensity. One state per
 * (substance, param) — resolver owns these.
 */
export class SpikeState {
  private burstUntil = 0;
  private nextCheck = 0;
  private env = 0;

  /** returns burst envelope 0..1; call once per frame */
  update(time: number, dt: number, intensity: number): number {
    if (time >= this.nextCheck) {
      this.nextCheck = time + 0.25;
      // expected burst rate: 0 at threshold → ~1 every 2.5 s at heavy
      const p = 0.25 * (0.4 * intensity * intensity + 0.02 * intensity);
      if (Math.random() < p) {
        this.burstUntil = time + 0.15 + Math.random() * 0.45 * (0.5 + intensity);
      }
    }
    const target = time < this.burstUntil ? 1 : 0;
    // fast attack, slower release — bursts pop in and fade out
    const rate = target > this.env ? 18 : 6;
    this.env += (target - this.env) * Math.min(1, rate * dt);
    return this.env;
  }
}

/** Tier stops on the continuous slider. */
export const TIER_STOPS = [0.0, 0.25, 0.5, 0.75, 1.0] as const;
export const TIER_NAMES = ['Threshold', 'Light', 'Common', 'Strong', 'Heavy'] as const;

/** Triangular basis weights over the five stops (for uTier[5]). */
export function tierWeights(x: number, out: Float32Array): Float32Array {
  for (let i = 0; i < 5; i++) {
    out[i] = Math.max(0, 1 - Math.abs(x - TIER_STOPS[i]) / 0.25);
  }
  return out;
}

export function tierIndex(x: number): number {
  let best = 0;
  for (let i = 1; i < 5; i++) {
    if (Math.abs(x - TIER_STOPS[i]) < Math.abs(x - TIER_STOPS[best])) best = i;
  }
  return best;
}
