# DEBT — realism hypotheses & deferred fixes

Log format: substance/mechanic — symptom — hypothesis — status.

## Salvia Heavy (M6.5 STEP 1 diagnosis, 2026-07-04)
The M6 `realityBreak` crossfaded to a fully *synthetic* panel world, so it read
as a pasted graphic rather than *this scene* dissolving. Root causes:
1. `sigWarp`'s strip-shear is a flat screen-space diagonal skew — it looks like a
   slide/PowerPoint transition, not reality coming apart. No recursive re-tiling,
   so the field never becomes "copies of itself."
2. No log-polar / form-constant structure: the lateral pull is a straight skew,
   which curves wrong versus the reported "pulled sideways through a seam."
3. The Heavy fake-world was built from `uSeedCol` alone (image-independent
   geometry), violating the CLAUDE.md core principle that distortion be driven by
   the image's own structure.
Fix (STEP 2): recursive `kaleiFold` re-tiling + log-polar seam-shear in `sigWarp`
so the *photo itself* re-tiles into copies; Heavy crossfades that folded, image-
derived field into a hard-posterized cartoon world with standing "watcher"
figures. Figures drawn in-signature (flat silhouettes) rather than via P3's
entity path — the P3 breakthrough tunnel is DMT-specific and signature modules
cannot reach P3's `drawFace` (architecture rule, HANDOFF §2); a shared
silhouette keeps salvia from looking like DMT.

## STEP 6 reconciliation (2026-07-04)
While reconciling the M6.5 realism pass with M6 calibration, found LSD's
`breathing/flowWarp/colorSat/patternMask/aberration/bloom` `max` values had each
been bumped by exactly `+1.0` in an uncommitted edit (e.g. `colorSat` 0.90→1.90).
Rendered check on brick wall: Light/Common/Heavy all read as the same
near-maxed, fully hue-shifted wash (red→orange→yellow), contradicting LSD's own
`tierNotes` ("Light: faint breathing, still deniable"; "Common: smooth-curve
params reach midrange") and the CLAUDE.md §0/§6 calibration bar. **Reverted to
the pre-diff values** (0.85/0.70/0.90/0.80/0.55/0.30) — confirmed the tier ramp
separates properly again after the revert.

Psilocybin's `earthHue` had been reverted 0.5→0.7 in the same uncommitted edit,
undoing the M6 calibration fix for the brick-wall-goes-full-olive-at-Strong
issue (`HANDOFF.md §4`). Rendered check confirms Strong now shows a strong
uniform amber wash on brick again — **user explicitly chose to keep 0.7**
despite this. Do not "fix" this back to 0.5 in a future session without
checking with the user first; it's a deliberate call, not an oversight.

Alcohol's `doubleVision`/`sway` max were cut hard (0.80→0.30, 0.70→0.30) in the
same edit. Static renders at Common and Strong show no clearly visible
diplopia, which is hard to reconcile with `tierNotes` ("Common: horizontal
doubling appears... Strong: constant diplopia") — but doubleVision oscillates
(convergence-hunting), so a still frame can catch it near a zero-crossing and
this needs a live/motion check to judge fairly, which this session didn't do
(budget). Kept as-is per the user's blanket "keep the diff" call; flagging for
a live look next session if alcohol stops reading as itself at Common.
