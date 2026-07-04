# HANDOFF — Dosed Lens, M6→M8

**To the incoming Claude:** you are taking over a 3-day build at the start of Day 3. M0–M5 are
done and committed. Your job is M6 (calibration), M7 (UX + export), M8 (README) from
`CLAUDE.md` — **read `CLAUDE.md` in the repo root fully before touching anything; it is the
spec and it wins any conflict with this file.** This document is everything the previous
session learned that is *not* in the spec: architecture decisions, tooling recipes, gotchas,
and precise instructions for the remaining milestones.

The user verifies each milestone manually. **Stop after each milestone commit and wait for
feedback. Do not run ahead.**

---

## 1. Where things stand

Local commits on `master` (no remote configured — never push, commit locally only):

```
5abeca5 feat: substance wave 3 - mdma/cannabis/meth/opioid/dph + particle layer
acd817f feat: substance wave 2 - psilocybin/dmt/salvia/nitrous
0098761 feat: signature modules + lsd/ketamine/alcohol
5b608f1 feat: P3/P5/P8 ported
edeeab5 feat: P1+P2
a5c3c92 chore: scaffold
```

All 12 substances are implemented and blind-distinguishable in spot checks. The full
shared pipeline (P1–P8) is live. Progress screenshots per milestone are in
`docs/progress/`. Working tree is clean. `npm install` is already done.

**Definition of done (spec §0):** each substance identifiable blind at Common+;
Threshold barely perceptible; Heavy degrades *in that substance's own way*. That bar is
what M6 exists to hit.

---

## 2. Architecture you must not break

- **Zero runtime dependencies.** GLSL loads via Vite `?raw` imports; include resolution
  and signature injection happen at runtime in `src/gl/program.ts` (`buildFragmentSource`
  assembles: version → precision → `common.glsl` → `uniform float uSig_*` decls → pass
  body with `//__SIGNATURE__` replaced). Do not add vite-plugin-glsl back.
- **Pass order is fixed** (`src/gl/graph.ts`): geometry → pattern → color → temporal →
  acuity → grain → post → present. P1 (analysis) is cached per image/resize. Gated passes
  (pattern, acuity, grain) are skipped when all their shared params ≈ 0.
- **`uPrev` = the temporal pass's own previous output (pre-post).** This is deliberate —
  feeding back the post output would accumulate vignette/grain in the tracer loop. The
  temporal pass renders into `prevPing.write`; everything else ping-pongs `scenePing`.
- **Signature modules** (`src/signatures/*.glsl`) compile into P2/P4/P5 *simultaneously*
  and recompile on substance switch. They may only reference: the `common.glsl` context
  (uTime, uIntensity, uTier[5], uAspect, uRes, uMouse, uFit, uSeedCol[4], uBright,
  uHistHead, samplers uScene/uSrc/uEdges/uLum/uPrev/uFlow/uHist, helpers hash/noise/fbm/
  pal/hueRot/luma/edgeAt/edgeTangent/lumAt/fitUV/rot2/histSample) **plus their own
  `uSig_<name>` uniforms** (auto-declared from the profile's `signatureParams` keys).
  **Never** reference pass-scoped `uP_*` uniforms from a module. Effects that need two
  scene taps or must paint outside the image (diplopia blends, ketamine's recession
  surround) belong in `sigColor`, not `sigWarp` (which is a pure uv→uv map).
- **Per-frame engine features are inferred from signature-param presence** in
  `src/main.ts`: `meltRate` → flow accumulator pass runs; `flange` → history ring
  records; `breakthrough` → P3 pattern-drive (entity/mandala/breakthrough uniforms);
  `onsetRush` → intensity overshoot envelope; `shadowEvents/silhouette/skitter/smoke/
  figureEvents/shadowFlicker` → particle layer config. Adding a param with one of these
  names to a profile activates the feature — that's the intended extension mechanism.
- **P3's entity/mandala/breakthrough uniforms are set unconditionally every frame** from
  `FrameState.pattern` — this prevents stale values across substance switches (P3 is not
  recompiled). Keep it that way.
- **Particle layer** (`src/engine/particles.ts`) draws via `graph.overlay` hook right
  before the post pass. It uses its own VAO — the graph **must rebind its quad VAO after
  the overlay** (already handled; if you touch that code, know that forgetting the rebind
  makes every later pass render black).
- **Perf budget** (spec §8): 60 fps @ 1080p integrated GPU; no per-frame allocations in
  the render loop (the graph uses a preallocated scratch array — keep that discipline).

## 3. Tooling recipes (Windows, this machine)

- Dev server: `npx vite --port 5199 --strictPort` (run in background). The app boots to
  LSD/Common/room-lamp.
- **Deep-link for tests:** `http://localhost:5199/#s=<id>&i=<0..1>&img=<sample-name>`
  e.g. `#s=salvia&i=0.75&img=02-brick-wall`. Samples: `01-room-lamp`, `02-brick-wall`,
  `03-forest`, `04-street-night`, `05-statue`, `06-sky`.
- **Screenshots: use `node scripts/screenshot.mjs "<url>" <out.png> [waitMs] [w] [h]`.**
  It drives headless Chrome over CDP, waits in *real* time, then captures. Give
  accumulating effects (psilocybin melt, tracers, opioid nod) 9–15 s of waitMs. Do NOT
  use `chrome --headless --screenshot --virtual-time-budget=N` — it needs ~N/16 rendered
  frames and silently writes nothing under SwiftShader load; that path burned an hour.
- A black canvas with a working panel = the sample image didn't load or a GL state bug;
  a `.boot-error` overlay element in the DOM = shader compile error (check with
  `--dump-dom` or read the element text in a screenshot).
- Clean up stray headless Chromes by matching the profile-dir pattern in
  `Win32_Process` command lines (`dl-cdp`), **never** by killing `chrome.exe` by name —
  the user's real browser is usually open.
- PowerShell 5.1 quirks: no `&&`; use `;`. **No embedded double quotes inside
  `git commit -m @'...'@` here-strings** — PS mangles native-command argument quoting and
  git sees garbage pathspecs (cost one failed commit). The LF→CRLF warnings on commit are
  harmless — ignore them.
- Typecheck with `npx tsc --noEmit` before each commit. GLSL has no typecheck — verify
  shaders by loading the app and looking for the boot-error overlay.

## 4. M6 — Calibration sweep (protocol in spec §6). Budget: half a day.

1. Start the dev server, then render the matrix with the screenshot script: for each of
   the 12 substances × 5 tier stops (`i=0.0,0.25,0.5,0.75,1.0`) on `01-room-lamp` **and**
   `02-brick-wall` (spec calls them samples #2 and #4). ~120 shots; a PowerShell loop over
   `scripts/screenshot.mjs` with waitMs 9000–15000 works. Put them in a scratch dir, not
   the repo.
2. Judge each against the profile's `tierNotes` (in `src/profiles/*.json`) and spec §5:
   - Threshold ≈ deniable (if you can name the substance from the Threshold frame, it's
     too hot — check LSD/meth `early`-curve params first).
   - Common ≈ unmistakable but scene-legible.
   - Heavy ≈ scene-threatening *in the substance's own way* (melt vs tunnel vs strips vs
     black nods — never just "same but more").
3. The blind test: look at the 12 Common renders unlabeled (shuffle filenames) and check
   each is attributable using only §5's phenomenology notes.
4. **Fixes go ONLY into curve choices and `max` values in profiles, and
   `signatureParams` numbers — never new shader features.** If a mechanic won't read
   after 3 tuning iterations, log it in `docs/DEBT.md` with a hypothesis and move on.
5. Remember temporal effects (tracers, stutter, hiccups, nystagmus, throb, nod) are
   invisible in stills — judge those by taking 2–3 shots at different waitMs and/or brief
   manual observation; ask the user to eyeball anything you can't verify headlessly.

Known calibration backlog from spot checks:
- Psilocybin earth-hue pull is a touch strong on red-heavy images (brick wall goes
  full olive at Strong) — consider `earthHue` 0.7 → ~0.5.
- LSD has both the signature mip-sharpen and shared `sharpenHalo` — check Threshold/Light
  isn't over-crisp.
- Ketamine was already tuned once (acuity 0.6→0.35, desat/cool up) — verify doubling
  still reads at Common after any global changes.
- Salvia Heavy tier is currently too weak compared to DMT. At Heavy (i=1.0), it must obliterate the     original image entirely and replace it with "fake reality" and figures. **Explicit override to M6       rules:** You have permission to modify Salvia's shader logic and JSON profile
- Nitrous/whiteOut and MDMA doubleVision are `late`-curve — confirm they actually appear
  by Heavy (late = x³ is brutal below 0.75).
- Commit: `tune: tier calibration sweep`. Update `tierNotes` where you changed behavior —
  the spec treats curve choices as first-class design that must be recorded.

## 5. M7 — UX + export (Day 3 pm)

What already exists (don't rebuild): grouped picker with DPH gate dialog
(`ui/picker.ts`, `ui/panel.ts`), labeled tier slider (`ui/slider.ts`), pause/split/
png/rec buttons (`ui/toggles.ts`), PNG export + WebM recorder (`engine/recorder.ts`,
wired), split-view present shader + drag handle (`ui/compare.ts`, present pass takes
`uSplit`), URL-hash read/write for `s`/`i` (`main.ts`), reduced-motion start-paused,
photosensitivity notes from `profile.warning`, samples row + upload + drag-drop.

Remaining work:
- **Fix: deep-linking `#s=dph` bypasses the deliriant gate.** On boot, if the hash
  substance is class `deliriant` and localStorage `dosed-lens-deliriant-ack` is unset,
  show the gate dialog before applying (fall back to LSD if declined).
- **Picker search:** a small text filter above the groups (spec: "grouped, searchable").
- **Per-effect override drawer:** collapsible section listing the active profile's shared
  params with 0–2× multiplier sliders feeding `resolver.overrides[name]` (already
  consumed by the resolver). Reset-all button. Keep the phenomenon design language
  (`ui/styles.css` tokens: --ink/--dim/--line/--accent, mono font, thin borders).
- **Permalink completeness:** encode `img` (and overrides if cheap) into the hash; the
  read side for `img` exists.
- **WebM polish:** the 10–30 s bound (spec) — recorder takes maxSeconds, expose 10/30 via
  UI or just cap at 30 and note it; verify a recording actually downloads in a real
  browser (MediaRecorder does not work headless — ask the user to click rec once).
- Keep the tier slider stops exactly as-is (Threshold·Light·Common·Strong·Heavy).
  **No numeric doses anywhere — no mg/µg, ever. Tier names only.** (Locked decision §1.)
- Commit style: conventional, e.g. `feat: picker search + override drawer + permalinks`.

Cut order if time runs out (spec §8): WebM export → override drawer → DPH figure events →
salvia page-turn. Never cut tier calibration quality.

## 6. M8 — Ship (`docs: readme`)

README.md with: what it is (perception-simulation art/education tool; all processing
client-side, images never leave the device); screenshot grid — reuse/refresh
`docs/progress/` images, ideally one striking hero (DMT Heavy breakthrough on room-lamp
is the showpiece; opioid mid-nod and salvia strips are also strong); how to run
(`npm install && npm run dev`); architecture sketch (pass graph + signature modules, a
few sentences); perf notes (levers listed in spec §8); controls/shortcuts (H panel,
space pause, 1–5 tiers, drag-drop image, split view); the disclaimer (no consumption/
sourcing/dosing content; simulation grounded in PsychonautWiki subjective-effect
reports — cite the `sources[]` convention); photosensitivity + deliriant-gate notes;
license note for the CC0 procedural samples (generated by `scripts/gen-samples.mjs`).

## 7. Working agreements (from CLAUDE.md §9 — these still bind you)

- After each milestone: screenshot sample `01-room-lamp` at Common for affected
  substances into `docs/progress/`, commit with the milestone.
- Phenomenology questions → PsychonautWiki subjective-effects pages; cite in the
  profile's `sources[]`. Don't guess. No dose numbers.
- All GLSL stays in files (hot-editable); no shader logic in TS strings.
- Commit at every milestone checkpoint, conventional-commit style, local only, and end
  commit messages with the Co-Authored-By line for your model.
- The user is hands-on: concise reports, lead with what changed and how to verify it.

## 8. Known non-blocking issues (fix only if they bite you)

- `scripts/screenshot.mjs` occasionally prints `ws error` during teardown after a
  successful write — harmless.
- The history ring keeps stale frames when a non-`flange` substance runs (it only
  records for nitrous) — invisible in practice since only nitrous samples it.
- Sample thumbnails highlight by filename match; uploaded images just clear the
  highlight.
- `docs/progress/m2-lsd-common-room.png` predates later color tuning — refresh progress
  shots during M6 if they drift from reality.
