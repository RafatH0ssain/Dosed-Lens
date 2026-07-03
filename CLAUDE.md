# CLAUDE.md — DOSED LENS build pipeline
**You are Claude Code, building this repo (`Dosed-Lens`) over ~3 working days. This document is the complete spec. Read it fully before writing code. Commit locally at every milestone checkpoint (no pushing — the remote isn't configured yet).**

---

## 0. Mission

A client-side web app: user loads an image (or webcam), picks one of **12 substances**, sets an intensity tier, and the canvas renders the photo as if the camera itself were under that substance — animated in real time, exportable as PNG or short WebM.

**Definition of done:** each substance is *identifiable blind*. A tester who reads the phenomenology notes in §5 (without seeing labels) can match render → substance at Common tier or above. Threshold must be barely perceptible; Heavy must degrade the way reports describe, not just "same effect, louder."

**Core realism principle:** distortions must be driven by the *image's own structure* (edges, luminance, texture frequency) — walls breathe along their own contours, mortar lines crawl along themselves, halos grow from actual light sources. Anything that looks like a screen-space overlay pasted on top is a bug.

Reference implementation for pattern math, feedback tracers, entity rendering, and post-processing: `ref/phenomenon.html` (already in repo, or request it). Port, don't rewrite.

---

## 1. Locked product decisions

- **Intensity = 5 qualitative tiers** on a continuous 0–1 slider: `Threshold · Light · Common · Strong · Heavy`. **No numeric doses (no mg/µg/mL) anywhere in code, UI, or copy** — tier vocabulary is the phenomenology-literature standard and dose→effect numbers would be both inaccurate and inappropriate. Non-negotiable.
- All processing client-side; images never leave the device. Say so in the About text.
- UI inherits the `phenomenon` design language: near-black, mono font, thin-line panel, level chips, `--accent:#c9f24b`.
- Deliriant profile is gated behind a one-time "this one is unsettling" confirm. Profiles using strobe/flicker (nitrous, meth, DMT) show a photosensitivity note. `prefers-reduced-motion` ⇒ start paused on a static processed frame.
- About text: perception-simulation art/education tool; no consumption, sourcing, or dosing content anywhere.

---

## 2. Stack & repo layout

Vite + vanilla TypeScript + WebGL2. No framework, no backend. One dependency allowed for GLSL includes (`vite-plugin-glsl`) — otherwise zero-dep.

```
Dosed-Lens/
├─ CLAUDE.md                  ← this file
├─ index.html
├─ ref/
│  └─ phenomenon.html         ← prior simulator (port source)
├─ public/samples/            ← 6 test images, see §7 M0
├─ src/
│  ├─ main.ts                 ← boot, loop, state
│  ├─ gl/
│  │  ├─ context.ts           ← GL init, extensions, resize
│  │  ├─ fbo.ts               ← ping-pong FBO manager
│  │  ├─ program.ts           ← compile/link, #include resolution, uniform cache
│  │  └─ graph.ts             ← pass scheduler (fixed order, weight-0 = skip)
│  ├─ passes/                 ← shared pipeline, one .frag each
│  │  ├─ analysis.frag        ← P1: luminance, Sobel edges, blur pyramid (cached per image)
│  │  ├─ geometry.frag        ← P2: breathing, drift, flowWarp, doubleVision, jitter, sway
│  │  ├─ pattern.frag         ← P3: form constants + entities, luminance/edge-masked (port)
│  │  ├─ color.frag           ← P4: hue drift, sat, bleed, casts, white-out
│  │  ├─ temporal.frag        ← P5: feedback tracers, frame echo, stutter (port)
│  │  ├─ acuity.frag          ← P6: blur fields, ghosting, sharpen-halo, DoF collapse
│  │  ├─ grain.frag           ← P7: visual snow, scintilla, floaters, starbursts
│  │  └─ post.frag            ← P8: aberration, bloom, vignette, tone (port)
│  ├─ signatures/             ← one GLSL module per substance (see §4 contract)
│  │  ├─ lsd.glsl  psilocybin.glsl  dmt.glsl  ketamine.glsl
│  │  ├─ salvia.glsl  nitrous.glsl  mdma.glsl  cannabis.glsl
│  │  ├─ alcohol.glsl  meth.glsl  dph.glsl  opioid.glsl
│  ├─ profiles/               ← one JSON per substance (schema §3)
│  ├─ engine/
│  │  ├─ resolver.ts          ← profile × tier × curves × overrides → uniforms
│  │  ├─ curves.ts            ← early/smooth/late/spike response curves
│  │  └─ recorder.ts          ← PNG frame + MediaRecorder WebM
│  └─ ui/
│     ├─ panel.ts  picker.ts  slider.ts  toggles.ts  compare.ts
│     └─ styles.css
└─ package.json / tsconfig / vite.config.ts
```

If the repo's existing folder skeleton differs, reconcile toward this layout in M0 and commit the move as its own commit.

---

## 3. Profile JSON schema

```json
{
  "id": "lsd",
  "name": "LSD",
  "class": "psychedelic",
  "warning": null,
  "shared": {
    "breathing":   {"curve": "smooth", "max": 0.85},
    "flowWarp":    {"curve": "late",   "max": 0.70},
    "tracers":     {"curve": "smooth", "max": 0.75},
    "colorSat":    {"curve": "early",  "max": 0.90},
    "hueDrift":    {"curve": "late",   "max": 0.60},
    "patternMask": {"curve": "late",   "max": 0.80},
    "acuity":      {"curve": "none",   "max": 0.0},
    "snow":        {"curve": "early",  "max": 0.30},
    "aberration":  {"curve": "smooth", "max": 0.55},
    "vignette":    {"curve": "none",   "max": 0.0}
  },
  "signatureParams": { "hdSharpen": 0.7, "fractalTile": 0.6, "rainbowTrail": 0.8 },
  "tierNotes": ["...", "...", "...", "...", "..."],
  "sources": ["psychonautwiki:visual-effects", "kluver-1928"]
}
```

Curves (`curves.ts`): `early` = √-like, active from Threshold; `smooth` = smoothstep; `late` = x³-like, only meaningful ≥ Strong; `spike` = brief stochastic bursts whose probability scales with intensity; `none` = 0. **This curve system is what makes tiers feel qualitatively different — treat curve choices as first-class design, and record them in `tierNotes`.**

---

## 4. Signature module system (the "deep mechanics" layer)

Shared passes give the family resemblance; **signature modules give each substance its identity.** One GLSL file per substance implementing this contract, injected into P2/P4/P5 via `#include` at program build (recompile on substance switch — that's fine, it's <50 ms):

```glsl
// Available context (uniforms/samplers bound by graph.ts):
//   uTime, uIntensity (0–1), uTier[5] (per-tier weights), uAspect
//   sampler2D uEdges  (P1: RG = Sobel dir, B = magnitude)
//   sampler2D uLum    (P1: luminance + blur pyramid in mips)
//   sampler2D uScene  (current pipeline color)
//   sampler2D uPrev   (previous output frame)
//   helpers: hash1/hash2/noise/fbm/hueRot/pal (shared include)

vec2 sigWarp(vec2 uv);              // runs inside P2 — geometric identity
vec3 sigColor(vec3 col, vec2 uv);   // runs inside P4 — color/overlay identity
vec3 sigTemporal(vec3 col, vec2 uv);// runs inside P5 — time-domain identity
```

A null module (all pass-through) must compile, so shared params alone produce a working substance during bring-up.

---

## 5. The 12 substances — phenomenology → mechanics

Chosen for maximum visual distinctiveness across the full range of drug classes. For each: what reports describe → exactly how to build it → tier progression. Ground-truth check against PsychonautWiki's visual-effects taxonomy per substance before tuning.

### 5.1 LSD — "sharper than reality, geometry living in textures"
Reports: enhanced acuity and saturation (not blur), drifting/breathing locked to surfaces, lattice/fractal overlays inside textures, long vivid tracers, symmetrical texture repetition at high tiers.
**Mechanics:** `sigWarp` — edge-tangent drift: advect UVs along the Sobel *tangent* field (perpendicular to gradient) so lines crawl along themselves; amplitude ∝ edge magnitude. `sigColor` — "HD" unsharp-halo (add high-mip minus low-mip luminance, clamped) + saturation push + lattice from P3 masked by mid-frequency texture energy. `sigTemporal` — rainbow trails: feedback tracer hue-advanced +12° per frame so moving objects leave spectral smears. Heavy adds **fractal tiling**: sample the scene at 2–3 kaleidoscopically folded UV copies and blend where texture energy is high (repeating-texture effect).
Tiers: T barely-drifting brick lines / L color pop + faint breathe / C full drift + short trails / S lattice surfaces + rainbow trails / H fractal tiling + everything simultaneously.

### 5.2 Psilocybin — "the world melts and flows, organic and earthy"
Reports: slower, larger-scale breathing; surfaces flow/melt downward like viscous liquid; water-ripple sheen; green/yellow-earth color pull; edges wiggle organically.
**Mechanics:** `sigWarp` — *melt accumulator*: a persistent low-res flow texture (CPU-updated or ping-pong R16F) that slowly accumulates downward displacement in high-luminance-gradient regions, then elastically relaxes — surfaces visibly slump and recover on a ~20 s cycle. Plus radial water-ripple (sin(r·k − t) displacement) emanating from the brightest point of the image (from P1 max-lum mip). `sigColor` — hue convergence toward olive/amber (rotate hues 15% toward 60–90°), mild glow around organic (low edge-frequency) regions. `sigTemporal` — soft long tracers, no rainbow.
Tiers: T colors slightly "deeper" / L slow large breathe / C visible melt begin + ripple / S full slumping surfaces / H scene flows like paint, near-total melt with pattern bleed-through.

### 5.3 DMT — "instant, fast, crystalline, then somewhere else entirely"
Reports: extremely rapid onset; high-frequency crisp geometry; chrysanthemum bloom; at breakthrough the scene is *replaced* by kaleidoscopic tunnel space with entities.
**Mechanics:** *onset envelope*: on tier change upward, intensity overshoots to target×1.3 over 2 s then settles (the "rush"). `sigWarp` — 8–13 Hz micro-shimmer on edges (fast small tangent oscillation). `sigColor` — hue quantization to a neon 6-color palette (posterize hue channel, keep luminance) blended in with intensity; chrysanthemum mandala (port) blended over the image center, masked by luminance. Heavy: crossfade the *entire scene* into the ported `phenomenon` tunnel + entity layer (eyes/jester available as toggles), with the photo's own colors seeding the palette (sample 4 dominant colors in M0 analysis, feed as uniforms).
Tiers: T shimmer on high-contrast edges / L crisp fast geometry in textures / C chrysanthemum blooming over scene / S geometry dominant, photo ghosting through / H breakthrough: full tunnel + entities, photo dissolved.

### 5.4 Ketamine — "the world becomes a flat painting at the end of a tunnel"
Reports: depth flattening, blurred doubled vision (often vertical), everything distant/small, motion feels frame-skipped, desaturation, tunnel vision; k-hole = receding into darkness.
**Mechanics:** `sigWarp` — vertical-divergence double vision (two taps offset ±y, offset grows with intensity) + *world recession*: uniform scale-down of scene inside a growing dark surround (scene shrinks to ~70% at Heavy, centered). `sigColor` — painting-flattening: bilateral-style smoothing (blur where edge magnitude is low, keep strong edges) + local contrast crush + desaturate toward cold gray-blue. `sigTemporal` — frame-hold stutter: hold previous output for 2–4 frames stochastically (probability ∝ intensity), producing the frame-skipped motion. Heavy: tunnel vignette closes to a soft-edged circle ~55% of frame; contents keep receding.
Tiers: T slight softness / L mild double + flatten / C clear doubling, stutter, desat / S world visibly shrinking + tunnel / H k-hole: small flat bright painting in darkness, heavy stutter.

### 5.5 Salvia — "reality shears into repeating strips and something pulls you sideways"
Reports: unique among all substances — visual field splits into repeating tiles/strips ("pages," "zippers," conveyor belts), strong lateral gravity, cartoon-flat color, abrupt not smooth.
**Mechanics:** `sigWarp` — *strip shear*: divide frame into N diagonal bands (N grows 3→9 with intensity); each band offsets along the band axis by band-index × drift(t), with hard (non-smooth) edges; every ~7 s a "page-turn" event where bands roll over with a cosine flip and the image re-tiles with 1 duplicated band (the repeat effect). Constant lateral pull: whole-frame skew toward screen-left growing with intensity. `sigColor` — cartoon flattening: strong posterize (5 levels) + edge-line darkening (Sobel as ink lines). `sigTemporal` — none smooth; motion is stepped (quantize time to 12 fps at Heavy).
Tiers: T faint lateral lean / L bands barely visible at edges / C visible shear strips + pull / S page-turn events, posterized / H frame fully tiled into repeating shearing copies, 12 fps stepping.

### 5.6 Nitrous oxide — "everything throbs in waves, echoing, warm and dim"
Reports: rhythmic 'wah-wah' throbbing of vision and sound, frame-echo/flanging, warm dimming, sparkles, short duration with a decaying envelope.
**Mechanics:** the identity is a **global throb LFO** at 2.5 Hz with a 25 s decay-and-restart envelope (mimics the short arc): `sigWarp` — scale pulses 1.00→1.015 on the LFO. `sigColor` — luminance and blur (mip level) pulse on the same LFO, phase-offset 90°; warm dim cast grows mid-envelope. `sigTemporal` — echo: blend `uPrev` sampled 1 throb-period ago (keep a 16-frame ring of downsampled history, pick by phase) so movement flanges at the throb rate; scintilla sparkles burst at envelope peak.
Tiers: T soft single pulse / L gentle throb / C full wah + echo + dim / S deep throb, strong flange, sparkle bursts / H near-whiteout at LFO peaks, audio-visual "wub" feel.

### 5.7 MDMA — "lights bloom into stars and your eyes wiggle"
Reports: light halos/starbursts, eye-wiggle (nystagmus) making the scene judder horizontally, saturation lift with magenta warmth, shimmer, mild double vision at high tiers.
**Mechanics:** `sigColor` — starburst kernel: detect bright points (top-mip luminance threshold), draw 4/6-ray flares + halo blooms scaled by brightness; magenta-biased saturation lift; global shimmer (very fine 30 Hz luminance dither on bright regions). `sigWarp` — nystagmus: whole-frame horizontal micro-oscillation, bursts of 0.3 s at 8 Hz with randomized onsets (probability ∝ intensity) — crucially *episodic*, not constant. Heavy adds slight double vision and peripheral shadow-flicker borrowed at low weight from meth module.
Tiers: T lights slightly juicier / L halos + warmth / C starbursts + first wiggle bursts / S constant shimmer, strong wiggle / H doubled starbursts, judder, edges flicker.

### 5.8 Cannabis — "subtle: warmer, laggier, halos, and time hiccups"
Reports: mild — halos around lights, slight motion lag/tracers, time perception hiccups, peripheral softening, warm/red shift, pattern breathing only at very high doses (edibles).
**Mechanics:** `sigTemporal` — *time hiccup*: every 4–9 s hold a frame for 120–250 ms then resume (subtle, unsettlingly organic); mild tracer weight. `sigColor` — warm lift, gentle halo bloom on lights, tiny red-shift; slight contrast drop. `sigWarp` — peripheral-only micro-breathing (masked by distance from center). This profile is deliberately the "realism floor": at Common it should be *almost* deniable.
Tiers: T nothing you could swear to / L warmth + faint halos / C hiccups + peripheral softness / S visible breathing at edges, lag / H edible-tier: real breathing + halo bloom + persistent lag.

### 5.9 Alcohol — "double vision, lag, and eventually the spins"
Reports: progressive diplopia (horizontal), motion blur lagging head movement, vignette narrowing, warm flush, horizon sway; heavy = the spins (rotational drift + nausea blur).
**Mechanics:** `sigWarp` — horizontal double vision with *slow convergence hunting* (offset oscillates ±20% at 0.3 Hz — eyes trying to fuse); horizon sway: frame roll ±1.5° sine at 0.15 Hz. `sigTemporal` — pan-lag smear: blend uPrev warped toward current with a 0.25 mix so any motion streaks. `sigColor` — warm flush + mild vignette. Heavy: **the spins** — roll bias accumulates into slow continuous rotation (0.5 rpm) with radial blur; stutter drops frames.
Tiers: T none / L softness + warmth / C doubling appears, sway / S constant diplopia + lag + narrowed field / H the spins.

### 5.10 Methamphetamine (high-dose / sleep-deprived) — "too sharp, snowing, and things move in the corners"
Reports: over-sharpened vigilant vision, visual snow, texture crawling in flat areas, peripheral shadow-flicker resolving to nothing when looked at; extreme = brief shadow-figure silhouettes.
**Mechanics:** `sigColor` — aggressive unsharp + contrast, cold desat, dense fine snow (from P7 at high weight). `sigWarp` — texture crawl: granular 1–2 px churn applied only where edge magnitude is *low* (flat walls crawl, objects stay). `sigTemporal` — **peripheral shadow events**: stochastic dark soft-blob masks spawn in the outer 20% of frame, drift 200–400 ms, and *fade instantly if the mouse (proxy for gaze) approaches* — this interaction detail sells it. Heavy: rare (p≈0.02/s) humanoid silhouette mask (simple dark capsule-and-head SDF, heavily blurred, 300 ms) at frame edge.
Tiers: T extra crispness / L snow visible on flats / C crawl + first corner flickers / S frequent shadow events, harsh contrast / H silhouettes, constant crawl, snowstorm.

### 5.11 Diphenhydramine / deliriant — "not colorful — *wrong*. Spiders in the corners and smoke in the room" ⚠ gated
Reports: realistic (non-geometric) hallucinations — insect/spider speck clusters skittering in periphery, cigarette-smoke wisps, phantom silhouettes in shadows, heavy blur waves, darkened desaturated field, dream/wake confusion.
**Mechanics:** no geometry, no rainbow — that's the point. `sigColor` — desaturate, darken, sickly sepia-green cast, slow blur *waves* (blur amount oscillates 0.1 Hz). Particle systems (instanced quads, CPU-driven, ~200 max): (a) *skitter clusters* — 8–20 dark 2–4 px specks with leggy jitter movement, spawning in periphery and low-luminance regions, scattering when mouse nears; (b) *smoke wisps* — 2–3 slow fbm-advected translucent gray ribbons. `sigTemporal` — shadow pareidolia: in the darkest image regions (bottom lum-mip threshold), slowly fade in barely-visible face/figure masks (reuse `phenomenon` face SDF at 8% opacity, desaturated) that dissolve when mouse approaches. Heavy: one scripted "someone standing there" event per 60 s — a dark human silhouette in the darkest corner for 500 ms.
Tiers: T unease: slight darkening / L first corner specks / C skitter clusters + smoke / S shadow faces, blur waves / H figure events, near-monochrome, constant motion in periphery.
UI: one-time confirm dialog before first activation.

### 5.12 Opioids (nod) — "warm, golden, pinholed — and the lights keep going out"
Reports: pinpoint pupils → dim warm vision, heavy lids, the "nod" cycle: vision sinks/darkens/blurs then snaps back; slowed perception.
**Mechanics:** the identity is the **nod state machine** in `sigTemporal`/`sigColor`: state AWAKE (drift: slow warm dim, mild blur) → NODDING (4–8 s: upper-lid gradient descends from frame top, blur + darkening ramp, frame sinks 2% downward, time slows — temporal mix toward uPrev 0.6) → SNAP (0.3 s: lid retracts, brief over-bright re-focus) → AWAKE. Cycle period shrinks and nod depth grows with intensity. Plus constant: golden-hour warm cast, pinhole vignette (soft circular, ~80%→55% of frame across tiers), slowed tracer weight.
Tiers: T warmth / L dim + first shallow nod per minute / C regular nods, pinholing / S deep nods to 90% black, heavy lids / H near-continuous nodding, seconds of black, syrup-slow motion.

---

## 6. Realism calibration protocol (run at M6, budget: half a day)

1. For each substance × each tier, render sample image #2 (indoor room w/ lamp) and #4 (brick wall).
2. Check against `tierNotes` and PsychonautWiki visual-effect descriptions: Threshold ≈ deniable, Common ≈ unmistakable but scene-legible, Heavy ≈ scene-threatening in the substance's *own* way.
3. The blind test from §0 with the 12 Common-tier renders.
4. Failure fixes go into curve shapes and `signatureParams`, never into new features.

---

## 7. Milestones (commit at each ✓, conventional-commit style, local only)

**M0 — Scaffold (Day 1 am)** ✓ `chore: scaffold`
Vite+TS boot, GL context, FBO ping-pong, pass graph with 8 stub passes, image upload + cover-fit + 6 sample images (shoot for: indoor room with lamp, brick wall, forest, street at night, portrait-style mannequin/statue, plain sky — generate or use CC0), profile loader + curve resolver, null signature module compiling. Acceptance: photo renders through all stub passes at 60 fps 1080p.

**M1 — Analysis + Geometry (Day 1 core)** ✓ `feat: P1+P2`
P1 cached edge/lum/pyramid; P2 shared warps. Acceptance: on brick wall, `breathing` bows the wall along its own contours and `flowWarp` makes mortar lines crawl along themselves with no tearing; toggling image re-caches P1 automatically.

**M2 — Ports (Day 1 pm)** ✓ `feat: P3/P5/P8 ported`
Pattern pass (luminance/edge-masked into photo), feedback tracers, post. Acceptance: LSD shared-params-only prototype looks credible.

**M3 — Signature system + first trio (Day 1 end)** ✓ `feat: signature modules + lsd/ketamine/alcohol`
Include-injection build, recompile-on-switch, LSD + ketamine + alcohol full modules. Acceptance: the three are blind-distinguishable at Common. **This is the go/no-go checkpoint — if it slips, cut §8 items before touching M3 quality.**

**M4 — Substance wave 2 (Day 2 am)** ✓ psilocybin, DMT (incl. breakthrough crossfade), salvia, nitrous.
**M5 — Substance wave 3 (Day 2 pm)** ✓ MDMA, cannabis, meth, opioid, DPH (with gate dialog). Particle layer built here (meth events + DPH systems share it).
**M6 — Calibration (Day 3 am)** ✓ `tune: tier calibration sweep` — protocol §6.
**M7 — UX + export (Day 3 pm)** ✓ picker (grouped, searchable), tier slider with labeled stops, per-effect override drawer, before/after split view, PNG export, WebM record (10–30 s), settings-in-URL-hash permalink, warnings/reduced-motion.
**M8 — Ship** ✓ `docs: readme` — README with screenshots, perf notes, disclaimer.

## 8. Cut list (in order, if behind) & perf budget

Cut order: webcam input (not even scheduled — pure bonus) → WebM export → override drawer → DPH figure events → salvia page-turn (keep strips). Never cut: M1 quality, M3 trio, tier calibration.
Perf: 60 fps @ 1080p integrated GPU. Levers: P3/P7 at half-res + upscale; particle cap 200; history ring at quarter-res. `uTier` and all uniforms in one block; no per-frame allocations in the loop.

## 9. Working agreements for Claude Code

- Read `ref/phenomenon.html` before M2; port its noise/palette/eye/jester/mandala/feedback code rather than re-deriving.
- After each milestone: run the app, screenshot sample #2 at Common tier for every completed substance into `/docs/progress/`, commit.
- When a phenomenology question arises mid-build, check PsychonautWiki's subjective-effects pages and cite the page in the profile's `sources[]` — don't guess, and don't add dose numbers.
- Keep every shader hot-editable: no logic in strings inside TS; all GLSL in files.
- If a mechanic isn't reading as realistic after 3 iterations, log it in `docs/DEBT.md` with your hypothesis and move on — calibration day exists for this.
