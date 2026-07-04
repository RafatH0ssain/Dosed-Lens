# HANDOFF — Dosed Lens, M6.5 (Realism Pass)

**To the incoming Claude (Opus 4.8):** M0–M6 are done. This is an **inserted milestone, M6.5**, that runs *before* M7. Its only goal: raise the realism of the substance effects that currently look weak — **salvia and meth are the priority; anything else that reads as fake gets the same treatment** — using documented reference techniques instead of guessing.

**Read `CLAUDE.md` (repo root) and `HANDOFF.md` (the M6→M8 doc) fully before touching anything. They win any conflict with this file.** In particular, the architecture rules in `HANDOFF.md §2` (signature-module contract, pass order, `uPrev` semantics, particle rebind) and the locked decisions in `CLAUDE.md §1` (five tiers, **no numeric doses ever**, client-side only) still bind you completely.

---

## 0. Orientation — what this milestone is and isn't

**Is:** improving the *look* of existing effects by adapting proven techniques; tuning; possibly rewriting the salvia and meth signature modules; adding at most a couple of small shared helpers. Everything stays in the existing architecture.

**Isn't:** a new pipeline, new passes, new dependencies, or a rewrite. If a fix seems to need a new pass, stop and ask — it almost certainly doesn't.

**Definition of done (unchanged from spec §0):** each substance identifiable blind at Common+; Threshold barely perceptible; Heavy degrades in that substance's *own* way. M6.5 succeeds when salvia and meth pass the blind test as convincingly as cannabis and LSD already do.

---

## 1. Reference resources — and the licensing rule that governs them

I researched the landscape. Here is what's genuinely useful, what each is good for, and — critically — **how you are allowed to use it.**

### ⚠️ LICENSING — read before you look at any source
- **ENTHEA** (`github.com/elder-plinius/ENTHEA`) is **AGPL-3.0 with the network clause.** If you copy its GLSL into Dosed-Lens, the *entire app* becomes AGPL and must be open-sourced including when hosted. **Do not paste ENTHEA code.** Use it as a *technique reference only*: read how it structures a form-constant engine or a substance signature, understand the math, then write our own implementation from the cited primary sources (Klüver, Bressloff–Cowan, etc., listed in its `SCIENCE.md`). Techniques and math are not copyrightable; its specific code is.
- **DeepDream / Hallucination Machine** (the academic gold-standard, `github.com/google/deepdream`, Apache-2.0) is a heavy Python/CNN pipeline. It is **not portable** into our real-time WebGL2 app in this timeframe and we will not attempt to embed it. It matters only as validation that our *edge/pattern-amplification* direction (pareidolic enhancement of existing image features) is the phenomenologically-correct one. Don't try to integrate it.

### The useful references, mapped to our weak spots

| Need | Reference | What to take (technique only) |
|---|---|---|
| Salvia tiling / recursive fold | Standard **polar-fold kaleidoscope** + **recursive feedback-zoom** (Shadertoy topic, TroikaTronix tiling-zoom writeup) | The mod-into-wedge-and-mirror fold; iterative UV re-tiling with per-iteration rotation/scale to get the "reality re-tiles into copies of itself" look |
| Salvia / DMT form constants done right | **Bressloff–Cowan (2001)**, **Klüver (1966)** via ENTHEA `SCIENCE.md` bibliography | The retino-cortical log-polar map (r,θ)→(log r, θ) that makes tunnels/spirals/lattices geometrically correct rather than eyeballed |
| Meth / visual-snow realism | **Damiano & Gervasi, "A Novel Computational Framework for Visual Snow Syndrome," IEEE Access 2025** (`github.com/DamianoP/VisualSnow`, and the peer-reviewed paper) | The actual spatial/temporal statistics of realistic visual snow — grain density, flicker rate, opacity — instead of generic film grain. This is the single best realism upgrade available for meth. |
| Pareidolic "things emerging from texture" (meth shadow-figures, deliriant) | DeepDream *principle* (amplify existing feature/edge responses) | Drive figure/speck emergence from the image's **own** high-edge-energy regions, so they feel discovered in the scene, not pasted — you already have `uEdges`/`uLum` for this |

If you want to view any of these live for study, do it in a browser tab, not by pulling code into the repo.

---

## 2. Efficiency rules for this milestone (keep the loop fast)

The biggest time-sink in this project has been the render/inspect cycle. Hold this discipline:

1. **One substance at a time, one STEP at a time.** Never edit salvia and meth in the same step.
2. **Iterate in the browser with hot-reload, not the screenshot script.** Vite HMR reloads `.glsl` via the `?raw` import on save. Keep `npx vite --port 5199 --strictPort` running; edit the `.glsl`; look. The screenshot script is for *recording verified results*, not for the tuning loop. (`HANDOFF.md §3` warns the headless path is slow and silently fails under load — respect that.)
3. **Deep-link straight to the case under test:** `http://localhost:5199/#s=salvia&i=1.0&img=02-brick-wall`. Test the *hardest* tier first (usually Heavy) — if the mechanic reads there, tune downward.
4. **Budget 3 tuning iterations per mechanic.** If it still doesn't read, log it in `docs/DEBT.md` with your hypothesis and move on — same rule as `HANDOFF.md §4.4`. Do not rabbit-hole.
5. **Typecheck before every commit** (`npx tsc --noEmit`); GLSL has no typecheck, so watch for the `.boot-error` overlay after each shader save.
6. Only capture screenshots (via `scripts/screenshot.mjs`, waitMs 9000–15000 for temporal effects) at the *end* of a step, for the progress folder and the user's sign-off.

---

## 3. The work — numbered steps. STOP after each.

Do these in order. Each ends with a commit and a **verification checklist you hand to the user.**

---

### STEP 1 — Salvia diagnosis + shared kaleidoscope helper
`HANDOFF.md §4` already grants explicit permission to rewrite salvia's shader and profile. Before rewriting, do the cheap thing:

- Read the current `src/signatures/salvia.glsl` and its profile. Write a 4–6 line diagnosis into `docs/DEBT.md`: *why* it reads as fake now (likely: the strip-shear is a flat screen-space skew with no recursive re-tiling and no log-polar form-constant structure, so it looks like a slide transition, not reality dissolving).
- Add a small, reusable helper to `src/signatures/common.glsl` (the shared include, so DMT can use it too): a correct **polar-fold** `vec2 kaleiFold(vec2 uv, float wedges)` and a **log-polar** `vec2 logPolar(vec2 uv)` / `invLogPolar`. Textbook implementations, our own code, `// technique ref: Klüver/Bressloff-Cowan form constants; standard polar fold`.

---

### STEP 2 — Rewrite salvia so Heavy *replaces* reality
Per `HANDOFF.md §4` backlog: at Heavy, salvia must obliterate the original image and replace it with tiled "fake reality" + figures, on par with DMT breakthrough — currently it's far too weak.

Rebuild `sigWarp`/`sigColor` around three stacked mechanics, each gated to intensity by the profile curves:
1. **Recursive re-tiling** (the salvia signature): iteratively fold the scene UV with `kaleiFold` 2–4 times, each iteration rotated and scaled, so the image becomes copies-of-copies of itself — reality re-tiling into a repeating quilt. Hard-edged, stepped in time (quantize to ~10–12 fps at Heavy per spec §5.5), with the periodic "page-turn" roll every ~7 s.
2. **Lateral gravity / seam pull** growing with intensity — the "pulled sideways through a seam" report — implemented as a log-polar shear so it curves correctly rather than a flat skew.
3. **Heavy-tier scene replacement:** above ~0.8 intensity, crossfade the tiled result into a flat, posterized, cartoon-colored "fake world" (reuse the existing posterize + Sobel-ink from the current module) and blend in **figures** — reuse the `phenomenon` face SDF via the existing particle/entity path (see `HANDOFF.md §2` — `figureEvents` param activates the particle layer; a `breakthrough`-style uniform drives entity render). Do **not** invent a new pass; wire through the mechanisms that already exist.

Keep the tier ramp honest: Threshold = faint lateral lean; Common = visible shear strips + pull, scene still legible; Heavy = fully re-tiled, stepped, figures present, original photo gone.

**STOP. Verify with user (deep-links provided):**
- `#s=salvia&i=0.25` deniable; `#s=salvia&i=0.5` clearly salvia but scene readable; `#s=salvia&i=1.0` original image is *gone*, replaced by tiled fake-reality + figures, comparable in force to `#s=dmt&i=1.0`.
- 60 fps holds at 1080p (check the perf HUD if present, else eyeball).
- Update salvia `tierNotes` to match new behavior; refresh `docs/progress/` salvia shots.
- Commit: `feat: salvia recursive re-tiling + heavy scene replacement`. Wait for OK.

---

### STEP 3 — Meth: realistic visual snow
Meth's snow currently reads as generic film grain. Adapt the *statistics* from the Damiano/Gervasi VSS framework (technique only, our own code):

- In `src/passes/grain.frag` (or the meth `sigColor`, whichever owns snow now — check first), replace the flat white-noise add with VSS-accurate snow: fine per-pixel grain at a **realistic density and low opacity**, refreshed at a **realistic temporal flicker rate** (not every frame — VSS snow shimmers at a characteristic rate; decouple grain reseed from framerate with a time-quantized hash), with a mix of dark and light specks (salt-and-pepper), not just additive white. Scale density/opacity with intensity via the existing param.
- Keep it edge-independent (snow is a full-field overlay) — this is separate from the texture-crawl in step 4.

**STOP. Verify with user:**
- `#s=meth&i=0.5&img=01-room-lamp`: snow looks like real visual snow (fine, shimmering, salt-and-pepper, semi-transparent), not TV static or film grain. Compare side-by-side against a reference VSS simulator in another tab if helpful.
- Snow is invisible at Threshold, unmistakable at Heavy.
- `// technique ref: Damiano & Gervasi 2025 VSS statistics` comment + add to meth `sources[]`.
- Commit: `feat: VSS-accurate visual snow for meth`. Wait for OK.

---

### STEP 4 — Meth: texture-crawl + peripheral shadow realism
The "things move in the corners / flat walls crawl" mechanics are what sell meth, per spec §5.10. Improve, don't replace:

- **Texture crawl:** confirm it's masked to *low* edge-magnitude regions (flat walls churn, objects stay). If it currently churns everywhere, gate it by `1.0 - edgeMag`. Make the churn granular and slow, not noisy.
- **Peripheral shadow events** (the DeepDream-principle bit): make the dark blobs **emerge from the image's own dark, high-edge-density regions** in the outer frame rather than spawning at random screen positions — use `uLum`/`uEdges` to pick spawn points so shadows feel like misread scene features. Keep the "fade when the mouse (gaze proxy) approaches" interaction — that detail is already right and is what makes it uncanny (`HANDOFF.md` confirms it's wired via the particle layer).
- **Heavy silhouettes:** verify the humanoid mask still fires rarely (p≈0.02/s) and only at Heavy.

**STOP. Verify with user:**
- `#s=meth&i=0.75`: walls crawl but objects are stable; shadow blobs appear in corners tied to actual dark scene regions and vanish when the cursor nears them.
- `#s=meth&i=1.0`: rare silhouette events; overall reads as sleep-deprived vigilance, not a horror filter.
- Refresh meth `docs/progress/` shots; update `tierNotes` if behavior changed.
- Commit: `feat: image-driven meth texture-crawl + peripheral shadows`. Wait for OK.

---

### STEP 5 — Sweep the other 10 for anything that now looks fake by comparison
With salvia and meth fixed, re-run the quick blind check from `HANDOFF.md §4.3` across all 12 at Common. The user already rates cannabis and LSD as spot-on; find the next-weakest one or two only.

- For each substance that reads as fake, apply the **cheapest** fix first, in this order: (a) curve/`max` retune in the profile, (b) `signatureParams` numbers, (c) small `sigColor`/`sigWarp` adjustment. **Fixes go into profiles and signature numbers before shader logic** — same rule as `HANDOFF.md §4.4`.
- Known backlog still open from `HANDOFF.md §4` that you may fold in here if cheap: psilocybin earth-hue too strong on red images (`earthHue` 0.7→~0.5); LSD double-sharpen at low tiers; verify nitrous `whiteOut` and MDMA `doubleVision` (late/x³ curves) actually appear by Heavy.
- Do **not** touch anything the user called spot-on unless it regressed.

**STOP. Verify with user:**
- Present the refreshed 12-at-Common progress grid.
- List each change made and why. Confirm nothing previously-good regressed.
- Commit: `tune: realism sweep across remaining substances`. Wait for OK.

---

### STEP 6 — Consolidate + reconcile with M6
This milestone edited behavior the M6 calibration sweep already tuned. Reconcile:

- Re-verify the `HANDOFF.md §4` M6 backlog items are all still satisfied (ketamine doubling still reads at Common after any global changes, Threshold tiers still deniable, etc.).
- Make sure every changed substance has updated `tierNotes` (spec treats curve choices as first-class design that must be recorded) and updated `sources[]` where a technique was adapted.
- Confirm `docs/progress/` reflects reality (`HANDOFF.md §8` notes some shots predate tuning).

**STOP. Verify with user:**
- Clean working tree, `npx tsc --noEmit` passes, app boots on all 12 with no `.boot-error`.
- Commit: `tune: reconcile M6.5 realism pass with M6 calibration`. Wait for OK.

**Then hand back to the M7 plan in `HANDOFF.md §5` (UX + export).** M6.5 does not touch UX, export, or the picker — that's M7's job, unchanged.

---

## 4. Guardrails (still binding — do not drift)

- **No numeric doses anywhere** — five tier names only (`CLAUDE.md §1`). If any new UI text sneaks in during a fix, it's tiers only.
- No new runtime dependencies; GLSL stays in files, hot-editable (`HANDOFF.md §2`, `§7`).
- No pasting code from ENTHEA (AGPL), Shadertoy (CC-BY-NC-SA), or any other source — technique and math only, re-implemented, cited in `// technique ref:` comments and `sources[]`. See §1.
- Commit locally only, conventional style, end each message with your Co-Authored-By line (`HANDOFF.md §7`).
- Respect the particle-layer VAO rebind and `uPrev` semantics (`HANDOFF.md §2`) — the two easiest ways to render everything black.
- Photosensitivity: salvia's new stepped/flashing Heavy and meth's flicker both need the existing `profile.warning` note shown (`HANDOFF.md §5`); set it if not already.
- If a mechanic won't read after 3 iterations → `docs/DEBT.md` + move on. Realism is the user's call; when unsure, stop and ask rather than pile on complexity.

---
*M6.5 v1 — insert between M6 and M7. Reference-informed realism pass. Stop-and-inspect after every step.*
