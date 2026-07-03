/**
 * profile × intensity × curves × overrides → per-frame uniform values.
 */

import { CurveName, SpikeState, evalCurve, tierWeights } from './curves';

export interface SharedParamSpec {
  curve: CurveName;
  max: number;
}

export interface Profile {
  id: string;
  name: string;
  class: string;
  warning: string | null;
  shared: Record<string, SharedParamSpec>;
  signatureParams: Record<string, number>;
  tierNotes: string[];
  sources: string[];
}

/**
 * Canonical shared params — the union every pass may read (as uP_<name>).
 * Profiles specify a subset; the rest resolve to 0.
 */
export const SHARED_PARAMS = [
  // P2 geometry
  'breathing', 'drift', 'flowWarp', 'doubleVision', 'jitter', 'sway',
  // P3 pattern
  'patternMask', 'symmetry',
  // P4 color
  'colorSat', 'desat', 'hueDrift', 'colorBleed', 'warmCast', 'coolCast', 'whiteOut', 'posterize',
  // P5 temporal
  'tracers', 'echo', 'stutter',
  // P6 acuity
  'acuity', 'sharpenHalo', 'ghosting', 'dof',
  // P7 grain
  'snow', 'scintilla', 'floaters', 'starbursts',
  // P8 post
  'aberration', 'bloom', 'vignette',
] as const;

export type SharedParamName = (typeof SHARED_PARAMS)[number];

export class Resolver {
  private spikes = new Map<string, SpikeState>();
  /** M7 override drawer: per-param multiplier on max (1 = as authored) */
  overrides: Record<string, number> = {};

  readonly shared: Record<string, number> = {};
  readonly sig: Record<string, number> = {};
  readonly tier = new Float32Array(5);

  private profile: Profile | null = null;

  setProfile(p: Profile): void {
    this.profile = p;
    this.spikes.clear();
    for (const k of Object.keys(this.sig)) delete this.sig[k];
    for (const [k, v] of Object.entries(p.signatureParams)) this.sig[k] = v;
  }

  get current(): Profile | null {
    return this.profile;
  }

  /** Compute all uniform values for this frame. */
  resolve(intensity: number, time: number, dt: number): void {
    tierWeights(intensity, this.tier);
    const p = this.profile;
    for (const name of SHARED_PARAMS) {
      const spec = p?.shared[name];
      if (!spec || spec.curve === 'none' || spec.max === 0) {
        this.shared[name] = 0;
        continue;
      }
      let v = evalCurve(spec.curve, intensity) * spec.max;
      if (spec.curve === 'spike') {
        let s = this.spikes.get(name);
        if (!s) this.spikes.set(name, (s = new SpikeState()));
        v *= s.update(time, dt, intensity);
      }
      v *= this.overrides[name] ?? 1;
      this.shared[name] = v;
    }
  }
}

/** Eagerly import all profile JSONs. */
export function loadProfiles(): Map<string, Profile> {
  const mods = import.meta.glob('../profiles/*.json', { eager: true }) as Record<
    string,
    { default: Profile }
  >;
  const map = new Map<string, Profile>();
  for (const m of Object.values(mods)) {
    const p = m.default;
    map.set(p.id, p);
  }
  return map;
}
