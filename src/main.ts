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
import { WebMRecorder } from './engine/recorder';
import { Camera, CameraError } from './engine/camera';
import { createPanel, setFPS } from './ui/panel';
import { createCompare } from './ui/compare';
import { createDebugHUD, debugEnabled, DebugHUD } from './ui/debug';

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
const camera = new Camera();
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

// #debug=1 turns on the diagnostic HUD; latched at boot, kept across hash syncs
const DEBUG = debugEnabled();
let hud: DebugHUD | null = null;

function syncHash(): void {
  const parts = [`s=${state.substance}`, `i=${state.intensity.toFixed(2)}`];
  if (state.image) parts.push(`img=${state.image}`);
  const ov = Object.entries(state.overrides).filter(([, m]) => m !== 1);
  if (ov.length) parts.push(`o=${ov.map(([n, m]) => `${n}:${m}`).join(',')}`);
  if (DEBUG) parts.push('debug=1');
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
  onWebcam() {
    if (graph.isLive) stopWebcam();
    else startWebcam();
  },
  onMirror(on) {
    mirrorPref = on;
    if (graph.isLive) graph.mirror = on;
  },
  onFlip() {
    flipCamera();
  },
  onPause(p) {
    state.paused = p;
  },
  onSplit(on) {
    state.split = on ? 0.5 : 0;
  },
  onPNG() {
    // must run synchronously in the click gesture so navigator.share() keeps
    // its user activation (iOS is strict) — capture the frame right here
    captureShare();
  },
  onWebM() {
    if (recorder.recording) recorder.stop();
    else recorder.start(canvas, `dosed-lens-${state.substance}`);
    return recorder.recording;
  },
});
createCompare(canvas, () => state.split, (v) => (state.split = v));

// no canvas recording (e.g. some iOS versions) → drop the rec button; PNG stays
if (!WebMRecorder.supported()) {
  document.querySelector<HTMLButtonElement>('[data-a="webm"]')?.remove();
}

// live-source (webcam) preferences + throttle clocks
let mirrorPref = true;
let liveEdgeAcc = 0; // P1 (edge/lum) re-analysis timer
let liveStatsAcc = 0; // CPU dominant-colors/bright-point timer
const LIVE_EDGE_HZ = 25; // P1 refresh rate on a live source
const LIVE_STATS_HZ = 5; // CPU getImageData rate (stalls the pipeline — keep low)

async function startWebcam(): Promise<void> {
  panel.setWebcamError(null);
  try {
    await camera.start();
  } catch (e) {
    panel.setWebcamError(e instanceof CameraError ? e.message : 'Could not start the camera.');
    return;
  }
  graph.setLiveSource(camera.video);
  applyFacing(); // front cam → mirrored, back cam → not
  state.image = null; // a live feed isn't a permalinkable image
  panel.setActiveSample(null);
  panel.setWebcam(true);
  liveEdgeAcc = liveStatsAcc = 999; // analyze the first live frame immediately
  syncHash();
  // reveal the flip control only when a second camera actually exists
  Camera.count().then((n) => panel.setFlipAvailable(n > 1));
}

async function flipCamera(): Promise<void> {
  if (!graph.isLive) return;
  panel.setWebcamError(null);
  try {
    await camera.flip();
  } catch (e) {
    panel.setWebcamError(e instanceof CameraError ? e.message : 'Could not switch camera.');
    return;
  }
  graph.setLiveSource(camera.video); // force a clean re-alloc (dims may change)
  applyFacing();
  liveEdgeAcc = liveStatsAcc = 999;
}

// front camera reads as a mirror (selfie); back camera shows the world as-is
function applyFacing(): void {
  const front = camera.facing === 'user';
  mirrorPref = front;
  graph.mirror = front;
  panel.setMirror(front);
}

function stopWebcam(): void {
  camera.stop();
  graph.clearLiveSource();
  graph.mirror = false;
  panel.setWebcam(false);
}

// robust black/white points for the conditioner's contrast stretch: the 4th
// and 96th luminance percentiles of the 24×24 grid (ignores stray pixels).
function levelsFromGrid(grid: Float32Array): [number, number] {
  const a = Array.from(grid).sort((x, y) => x - y);
  const black = a[Math.floor(a.length * 0.04)];
  const white = a[Math.floor(a.length * 0.96)];
  return [black, Math.max(white, black + 0.1)];
}

// lift chroma of the seed palette in place (webcam colors are white-balanced flat)
function saturateColors(cols: Float32Array, s: number): void {
  for (let i = 0; i < cols.length; i += 4) {
    const r = cols[i], g = cols[i + 1], b = cols[i + 2];
    const l = r * 0.2126 + g * 0.7152 + b * 0.0722;
    cols[i] = Math.min(1, Math.max(0, l + (r - l) * s));
    cols[i + 1] = Math.min(1, Math.max(0, l + (g - l) * s));
    cols[i + 2] = Math.min(1, Math.max(0, l + (b - l) * s));
  }
}

function loadImageURL(url: string, done?: () => void): void {
  if (graph.isLive) stopWebcam(); // a still image replaces the live feed
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
// Pointer → effect focus (LSD fold centre, particle gaze). On desktop the
// mouse drives it on hover. On touch there is no hover: the effect stays
// centred, follows the finger while held, and eases back to centre on release.
let touchActive = false;
function setPointer(clientX: number, clientY: number): void {
  state.mouse[0] = clientX / innerWidth;
  state.mouse[1] = 1 - clientY / innerHeight;
}
addEventListener('pointermove', (e) => {
  if (e.target !== canvas) return; // ignore moves over the panel/UI
  if (e.pointerType === 'touch' && !touchActive) return;
  setPointer(e.clientX, e.clientY);
});
addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' && e.target === canvas) {
    touchActive = true;
    setPointer(e.clientX, e.clientY);
  }
});
function endTouch(e: PointerEvent): void {
  if (e.pointerType !== 'touch') return;
  touchActive = false;
  state.mouse[0] = 0.5; // return the focus to screen centre
  state.mouse[1] = 0.5;
}
addEventListener('pointerup', endTouch);
addEventListener('pointercancel', endTouch);
// never leave the camera running after the page goes away
addEventListener('pagehide', () => camera.stop());

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

// Capture the current frame and hand it to the native share sheet (mobile) or
// download it (desktop). Called synchronously from the shutter/PNG click so the
// share() call still has transient user activation. preserveDrawingBuffer is
// off, so we re-render once here to guarantee a valid buffer before reading it.
async function captureShare(): Promise<void> {
  graph.render(frameState);
  const name = `dosed-lens-${state.substance}-${state.intensity.toFixed(2)}.png`;
  const blob = dataURLtoBlob(canvas.toDataURL('image/png'));
  const file = new File([blob], name, { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (d?: ShareData) => boolean;
    share?: (d: ShareData) => Promise<void>;
  };
  // native share sheet on touch devices; download on desktop
  if (matchMedia('(pointer: coarse)').matches && nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: 'Dosed Lens', text: 'Made with Dosed Lens' });
      return;
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return; // user dismissed
      // any other failure → fall through to a download
    }
  }
  saveBlob(blob, name);
}

function dataURLtoBlob(url: string): Blob {
  const [head, b64] = url.split(',');
  const mime = /:(.*?);/.exec(head)?.[1] ?? 'image/png';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
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
  hud?.tick(now);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!state.paused) state.time += dt;

  // live source: refresh the analysis on two independent, throttled clocks so
  // a 60 fps feed doesn't pay for P1 + a getImageData stall every frame.
  // (texture upload itself happens every frame inside graph.render.)
  if (graph.isLive && camera.ready && !state.paused) {
    liveEdgeAcc += dt;
    if (liveEdgeAcc >= 1 / LIVE_EDGE_HZ) {
      graph.refreshAnalysis(); // recompute edge field + luminance pyramid (GPU)
      liveEdgeAcc = 0;
    }
    liveStatsAcc += dt;
    if (liveStatsAcc >= 1 / LIVE_STATS_HZ) {
      const stats = analyzeImage(camera.video); // CPU getImageData — kept rare
      // feed the GPU conditioner auto-levels + vivify the muted webcam palette
      const [black, white] = levelsFromGrid(stats.lumGrid);
      graph.setConditioning(black, white);
      saturateColors(stats.colors, 1.3);
      graph.seedColors.set(stats.colors);
      if (graph.mirror) stats.bright[0] = 1 - stats.bright[0]; // match flipped view
      graph.brightPos.set(stats.bright);
      particles.setImageStats(stats);
      liveStatsAcc = 0;
    }
  }

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
  if (!state.paused) particles.update(dt, inten, state.mouse, particleCfg);

  graph.render(frameState);

  fpsFrames++;
  if (now - fpsLast > 500) {
    const fps = (fpsFrames * 1000) / (now - fpsLast);
    setFPS(`${Math.round(fps)} fps`);
    adaptQuality(fps);
    fpsFrames = 0;
    fpsLast = now;
  }
}

// Adaptive render-scale: drop internal resolution when the framerate sags,
// recover slowly when it's smooth. Held steady while recording so the encoder
// never sees a resolution change. Runs on the ~2/s fps tick.
//
// Every scale change reallocates the whole target set, which is expensive and
// briefly resets the temporal feedback buffer, so changes must be rare. A
// single sagging tick is not enough: the framerate has to stay outside the
// band for STREAK_TICKS consecutive samples before the scale moves. The band
// is also wide (45..58) so that the post-downscale framerate cannot immediately
// re-trigger an upscale — that oscillation was what made the scale thrash.
const DOWN_FPS = 45;
const UP_FPS = 58;
const STREAK_TICKS = 3;
let qualityCooldown = 0;
let lowStreak = 0;
let highStreak = 0;
function adaptQuality(fps: number): void {
  if (recorder.recording) return;
  if (qualityCooldown > 0) {
    qualityCooldown--;
    lowStreak = highStreak = 0;
    return;
  }
  const s = ctx.renderScale;
  lowStreak = fps < DOWN_FPS ? lowStreak + 1 : 0;
  highStreak = fps > UP_FPS ? highStreak + 1 : 0;
  if (lowStreak >= STREAK_TICKS && s > 0.5) {
    ctx.setRenderScale(s - 0.15); // back off when the sag is sustained
    qualityCooldown = 6; // ~3 s before the next step
    lowStreak = 0;
  } else if (highStreak >= STREAK_TICKS && s < 1) {
    ctx.setRenderScale(s + 0.08); // creep back up when there's real headroom
    qualityCooldown = 8;
    highStreak = 0;
  }
}

forceResize(ctx);
if (DEBUG) hud = createDebugHUD(ctx, graph, camera);
requestAnimationFrame(frame);

// PWA: register the offline service worker (installable + works offline).
// Production only. sw.js is stale-while-revalidate — it answers from cache and
// refreshes in the background — so on the dev server it shadows the bundle you
// just rebuilt with the previous one, and keeps serving the app on localhost
// long after vite has stopped. In dev, tear down anything a previous run left
// registered instead, so the origin cleans itself up on the next page load.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((rs) => Promise.all(rs.map((r) => r.unregister())))
      .catch(() => {});
    if (typeof caches !== 'undefined') {
      caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))).catch(() => {});
    }
  }
}
