/** Boot, render loop, state. */

window.addEventListener('error', (e) => {
  const el = document.getElementById('app');
  if (el && !el.querySelector('.boot-error')) {
    const pre = document.createElement('pre');
    pre.className = 'boot-error';
    pre.style.cssText =
      'position:fixed;inset:auto 16px 16px 16px;max-height:50vh;overflow:auto;' +
      'color:#f2a24b;background:rgba(8,7,10,.9);border:1px solid rgba(242,162,75,.4);' +
      'border-radius:8px;padding:12px;font-size:11px;z-index:99;white-space:pre-wrap;';
    pre.textContent = String(e.error?.stack ?? e.message);
    el.appendChild(pre);
  }
});

import { createContext, forceResize } from './gl/context';
import { Graph, PassSource } from './gl/graph';
import { Resolver, loadProfiles } from './engine/resolver';
import { TIER_STOPS } from './engine/curves';
import { analyzeImage } from './engine/domcolors';
import { ParticleLayer, ParticleConfig } from './engine/particles';
import { WebMRecorder, savePNG } from './engine/recorder';
import { createPanel, setFPS } from './ui/panel';
import { createCompare } from './ui/compare';

import common from './passes/common.glsl?raw';
import analysisFrag from './passes/analysis.frag?raw';
import flowFrag from './passes/flow.frag?raw';
import geometryFrag from './passes/geometry.frag?raw';
import patternFrag from './passes/pattern.frag?raw';
import colorFrag from './passes/color.frag?raw';
import temporalFrag from './passes/temporal.frag?raw';
import acuityFrag from './passes/acuity.frag?raw';
import grainFrag from './passes/grain.frag?raw';
import postFrag from './passes/post.frag?raw';
import nullSig from './signatures/null.glsl?raw';

const signatureMods = import.meta.glob('./signatures/*.glsl', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function signatureFor(id: string): string {
  return signatureMods[`./signatures/${id}.glsl`] ?? nullSig;
}

const PASSES: PassSource[] = [
  { name: 'geometry', body: geometryFrag, signature: true, gates: null },
  { name: 'pattern', body: patternFrag, signature: false, gates: ['patternMask'] },
  { name: 'color', body: colorFrag, signature: true, gates: null },
  { name: 'temporal', body: temporalFrag, signature: true, gates: null },
  { name: 'acuity', body: acuityFrag, signature: false, gates: ['acuity', 'sharpenHalo', 'ghosting', 'dof'] },
  { name: 'grain', body: grainFrag, signature: false, gates: ['snow', 'scintilla', 'floaters', 'starbursts'] },
  { name: 'post', body: postFrag, signature: false, gates: null },
];

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = createContext(canvas);
const graph = new Graph(ctx, PASSES, analysisFrag, common, flowFrag);
const profiles = loadProfiles();
const resolver = new Resolver();
const recorder = new WebMRecorder();
const particles = new ParticleLayer(ctx.gl);
graph.overlay = (w, h, t) => particles.draw(w, h, t);
const particleCfg: ParticleConfig = { shadow: 0, silhouette: 0, skitter: 0, smoke: 0, figure: 0 };

const state = {
  substance: 'lsd',
  intensity: TIER_STOPS[2] as number, // Common
  paused: false,
  split: 0,
  time: 0,
  mouse: [0.5, 0.5] as [number, number],
  image: '01-room-lamp' as string | null, // null once a local upload is loaded
  overrides: {} as Record<string, number>, // non-default per-effect multipliers
};

function syncHash(): void {
  const parts = [`s=${state.substance}`, `i=${state.intensity.toFixed(2)}`];
  if (state.image) parts.push(`img=${state.image}`);
  const ov = Object.entries(state.overrides).filter(([, m]) => m !== 1);
  if (ov.length) parts.push(`o=${ov.map(([n, m]) => `${n}:${m}`).join(',')}`);
  history.replaceState(null, '', `#${parts.join('&')}`);
}

function smooth01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

const panel = createPanel(document.getElementById('app')!, profiles, {
  onSubstance(id) {
    state.substance = id;
    const p = profiles.get(id)!;
    // a fresh substance has its own param set — clear any prior overrides
    for (const k of Object.keys(resolver.overrides)) delete resolver.overrides[k];
    state.overrides = {};
    resolver.setProfile(p);
    graph.setSignature(signatureFor(id), Object.keys(p.signatureParams));
    panel.setSubstance(p);
    syncHash();
  },
  onIntensity(v) {
    state.intensity = v;
    syncHash();
  },
  onOverride(name, mult) {
    resolver.overrides[name] = mult;
    if (mult === 1) delete state.overrides[name];
    else state.overrides[name] = mult;
    syncHash();
  },
  onSample(url) {
    loadImageURL(url);
  },
  onUpload(file) {
    const url = URL.createObjectURL(file);
    loadImageURL(url, () => URL.revokeObjectURL(url));
    panel.setActiveSample(null);
  },
  onPause(p) {
    state.paused = p;
  },
  onSplit(on) {
    state.split = on ? 0.5 : 0;
  },
  onPNG() {
    pngRequested = true;
  },
  onWebM() {
    if (recorder.recording) recorder.stop();
    else recorder.start(canvas, `dosed-lens-${state.substance}`);
    return recorder.recording;
  },
});
createCompare(canvas, () => state.split, (v) => (state.split = v));

function loadImageURL(url: string, done?: () => void): void {
  const img = new Image();
  img.onload = () => {
    graph.setImage(img, img.naturalWidth, img.naturalHeight);
    const stats = analyzeImage(img);
    graph.seedColors.set(stats.colors);
    graph.brightPos.set(stats.bright);
    particles.setImageStats(stats);
    const m = url.match(/samples\/(.+)\.png/);
    state.image = m ? m[1] : null; // local uploads aren't permalinkable
    panel.setActiveSample(state.image);
    syncHash();
    done?.();
  };
  img.src = url;
}

// keyboard
addEventListener('keydown', (e) => {
  if (e.key === ' ' && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault();
    state.paused = !state.paused;
    panel.setPaused(state.paused);
  }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 5) {
    state.intensity = TIER_STOPS[n - 1];
    panel.setIntensity(state.intensity);
  }
});
addEventListener('pointermove', (e) => {
  state.mouse[0] = e.clientX / innerWidth;
  state.mouse[1] = 1 - e.clientY / innerHeight;
});

// initial state, overridable via URL hash
// (#s=lsd&i=0.5&img=02-brick-wall&o=breathing:1.5,tracers:0)
const hash = new URLSearchParams(location.hash.slice(1));
const hs = hash.get('s');
const hi = parseFloat(hash.get('i') ?? '');
if (!Number.isNaN(hi)) state.intensity = Math.min(1, Math.max(0, hi));

// per-effect override multipliers (o=name:mult,name:mult), clamped to 0..2
const initOverrides: Record<string, number> = {};
for (const pair of (hash.get('o') ?? '').split(',')) {
  const [n, v] = pair.split(':');
  const m = parseFloat(v);
  if (n && !Number.isNaN(m)) initOverrides[n] = Math.min(2, Math.max(0, m));
}

// A deliriant deep-link must still clear the gate on first visit: apply a
// safe default now, then route the requested id through panel.pick (which
// shows the confirm dialog when the ack is missing, or applies it directly).
let deferredPick: string | null = null;
if (hs && profiles.has(hs)) {
  if (profiles.get(hs)!.class === 'deliriant') deferredPick = hs;
  else state.substance = hs;
}

panel.setIntensity(state.intensity);
const p0 = profiles.get(state.substance)!;
resolver.setProfile(p0);
graph.setSignature(signatureFor(state.substance), Object.keys(p0.signatureParams));
// seed overrides only for a directly-applied substance (they were authored
// for it, not for the safe default shown while a gate is pending)
panel.setSubstance(p0, deferredPick ? undefined : initOverrides);
loadImageURL(`/samples/${hash.get('img') ?? '01-room-lamp'}.png`);

if (deferredPick) panel.pick(deferredPick);


if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  state.paused = true;
  panel.setPaused(true);
}

let pngRequested = false;
let last = performance.now();
let fpsFrames = 0;
let fpsLast = performance.now();

// displayed intensity follows the slider with a short attack; substances
// with an `onsetRush` param (DMT) overshoot ×1.3 on upward moves — the rush
let dispIntensity = state.intensity;
let rushTarget = state.intensity;
let rushPeak = 0; // remaining overshoot amplitude

// eased pointer for the kaleidoscope centre: drifts behind the real cursor so
// the fold singularity glides rather than snapping. Particles still use the raw
// state.mouse (the gaze-proxy fade must react instantly).
const smoothMouse: [number, number] = [0.5, 0.5];

const frameState = {
  time: 0,
  dt: 0,
  intensity: 0,
  tier: resolver.tier,
  shared: resolver.shared,
  sig: resolver.sig,
  mouse: smoothMouse,
  split: 0,
  flow: 0,
  hist: 0,
  pattern: { entity: 0, eyes: 0, faces: 0, jester: 0, mandala: 0, breakthrough: 0, boost: 0 },
};

function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!state.paused) state.time += dt;

  // ease the kaleidoscope centre toward the cursor (slow ~2.2 s time constant)
  const mk = 1 - Math.exp(-dt / 2.2);
  smoothMouse[0] += (state.mouse[0] - smoothMouse[0]) * mk;
  smoothMouse[1] += (state.mouse[1] - smoothMouse[1]) * mk;

  // intensity dynamics
  const sig = resolver.sig;
  if (state.intensity !== rushTarget) {
    if (sig.onsetRush && state.intensity > rushTarget) {
      rushPeak = (state.intensity - rushTarget) * 0.3 * sig.onsetRush;
    }
    rushTarget = state.intensity;
  }
  const goal = Math.min(rushTarget + rushPeak, 1.15);
  dispIntensity += (goal - dispIntensity) * Math.min(1, 4.5 * dt);
  rushPeak *= Math.exp(-dt / 0.8); // overshoot settles over ~2 s
  const inten = Math.min(dispIntensity, 1);

  resolver.resolve(inten, state.time, state.paused ? 0 : dt);
  frameState.time = state.time;
  frameState.dt = state.paused ? 0 : dt;
  frameState.intensity = inten;
  frameState.split = state.split;

  // substance-specific engine features, inferred from signature params
  frameState.flow = sig.meltRate ? sig.meltRate * Math.min(inten * 2, 1) : 0;
  frameState.hist = sig.flange ? 1 : 0;
  const pd = frameState.pattern;
  if (sig.breakthrough) {
    // DMT: mandala from Common, full tunnel + entities at Heavy
    pd.mandala = (sig.mandala ?? 0) * smooth01((inten - 0.35) / 0.4);
    pd.breakthrough = sig.breakthrough * smooth01((inten - 0.78) / 0.22);
    pd.entity = smooth01((inten - 0.8) / 0.2);
    pd.eyes = 1; pd.faces = 1; pd.jester = 1;
    pd.boost = 1;
  } else {
    pd.entity = 0; pd.eyes = 0; pd.faces = 0; pd.jester = 0;
    pd.mandala = 0; pd.breakthrough = 0; pd.boost = 0;
  }

  // particle layer config from signature params (meth / DPH / MDMA-heavy)
  particleCfg.shadow = (sig.shadowEvents ?? 0) * smooth01((inten - 0.35) / 0.4)
                     + (sig.shadowFlicker ?? 0) * smooth01((inten - 0.8) / 0.2);
  particleCfg.silhouette = (sig.silhouette ?? 0) * smooth01((inten - 0.82) / 0.18);
  particleCfg.skitter = (sig.skitter ?? 0) * smooth01((inten - 0.28) / 0.3);
  particleCfg.smoke = (sig.smoke ?? 0) * smooth01((inten - 0.35) / 0.35);
  particleCfg.figure = (sig.figureEvents ?? 0) * smooth01((inten - 0.8) / 0.2);
  if (!state.paused) particles.update(dt, state.time, inten, state.mouse, particleCfg);

  graph.render(frameState);

  if (pngRequested) {
    pngRequested = false;
    savePNG(canvas, `dosed-lens-${state.substance}-${state.intensity.toFixed(2)}`);
  }

  fpsFrames++;
  if (now - fpsLast > 500) {
    setFPS(`${Math.round((fpsFrames * 1000) / (now - fpsLast))} fps`);
    fpsFrames = 0;
    fpsLast = now;
  }
}

forceResize(ctx);
requestAnimationFrame(frame);
