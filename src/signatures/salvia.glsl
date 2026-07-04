/* Salvia — "reality re-tiles into copies of itself around wherever you're
   looking, something drags you sideways through a seam, and at the peak the
   room is *replaced* by a loud flat cartoon world."
   sigWarp:  recursive kaleiFold re-tiling centred on the cursor (the kaleido-
             scope singularity follows the mouse), a log-polar seam-shear for
             the curved lateral pull, hard stepped time (~11 fps) and a ~7 s
             page-turn roll.
   sigColor: subtle content-aligned ink; then — Strong/Heavy — a reality-break
             that remaps the already-folded scene through a vivid cartoon
             palette (image-driven, loud, not washed out). No figures.
   sigTemporal: —
   Params: foldTile, seamPull, pageTurn, inkLines, realityBreak
   technique ref: Klüver/Bressloff-Cowan form constants; standard polar fold
                  (helpers kaleiFold/logPolar live in passes/common.glsl). */

vec2 sigWarp(vec2 uv){
  float inten = uIntensity;
  /* gentle stepped time — a hint of salvia's abrupt quality without the choppy
     lag the harsh 11 fps quantize gave at max (softer 18 fps, partial blend) */
  float stepAmt = smoothstep(0.72, 1.0, inten) * 0.55;
  float t = mix(uTime, floor(uTime * 18.0) / 18.0, stepAmt);

  vec2 asp = vec2(uAspect, 1.0);
  vec2 ctr = uMouse;                 /* kaleidoscope centre follows the cursor */
  vec2 p = (uv - ctr) * asp;

  /* ---- organic domain warp BEFORE folding: the tiles flow and melt rather
     than being a rigid mirror-rotation of the photo — this is what abstracts
     the sharp kaleidoscope into something closer to DMT/LSD's richness ---- */
  float warpAmt = smoothstep(0.30, 1.0, inten);
  if (warpAmt > 0.001) {
    vec2 w1 = vec2(fbm(p * 2.4 + t * 0.15),
                   fbm(p * 2.4 + vec2(5.2, 1.3) - t * 0.12));
    p += w1 * 0.30 * warpAmt;
  }

  /* ---- lateral gravity as a log-polar shear: the field is dragged along a
     curving seam rather than a flat skew, plus a steady sideways creep ---- */
  float pull = uSig_seamPull * smoothstep(0.02, 0.7, inten);
  if (pull > 0.001) {
    vec2 lp = logPolar(p);
    lp.y += pull * (0.25 + 0.12 * sin(t * 0.23));   /* curved swirl-drag */
    p = invLogPolar(lp);
    p.x -= pull * (0.06 + 0.03 * sin(t * 0.19));     /* steady sideways gravity */
  }

  /* ---- recursive re-tiling: fold the sampling coord into mirrored wedges,
     each pass rotated + zoomed, so the scene becomes copies-of-copies. Louder
     and larger by Strong — more iterations wake sooner, deeper zoom. ---- */
  float tile = uSig_foldTile * smoothstep(0.26, 0.95, inten);
  if (tile > 0.001) {
    float wedges = mix(4.0, 10.0, smoothstep(0.28, 1.0, inten));
    float iters = tile * 3.2;
    for (int i = 0; i < 3; i++) {
      float w = clamp(iters - float(i), 0.0, 1.0);
      if (w < 0.001) break;
      vec2 f = kaleiFold(p, wedges);
      f = rot2(f, 0.35 + t * 0.06 + float(i) * 0.7);
      f *= 1.20;                                     /* deeper zoom → more space */
      p = mix(p, f, w);
    }
  }

  /* ---- post-fold turbulence: break the hard mirror seams into wavy abstract
     flow, so it never reads as a clean rotation of the source image ---- */
  if (warpAmt > 0.001) {
    vec2 w2 = vec2(fbm(p * 3.2 + 3.0 + t * 0.10),
                   fbm(p * 3.2 + 8.0 - t * 0.08));
    p += w2 * 0.16 * warpAmt;
  }

  /* ---- page-turn: every ~7 s the whole tiling rolls over ---- */
  float ev = fract(t / 7.0);
  float turn = smoothstep(0.02, 0.16, ev) * (1.0 - smoothstep(0.16, 0.34, ev));
  turn *= uSig_pageTurn * smoothstep(0.4, 1.0, inten);
  p = rot2(p, turn * 0.5);
  p.x += turn * 0.12;

  uv = p / asp + ctr;
  return uv;
}

vec3 sigColor(vec3 col, vec2 uv){
  float inten = uIntensity;

  /* ---- content-aligned ink: darken along the *displayed* (folded) scene's
     own contrast so lines sit on what you see, not on the un-folded original.
     Kept subtle — heavy ink read as background contrast artefacts before. ---- */
  float wl = uSig_inkLines * smoothstep(0.45, 1.0, inten);
  if (wl > 0.004) {
    vec2 px = 1.3 / uRes;
    float gx = luma(texture(uScene, uv + vec2(px.x, 0.0)).rgb)
             - luma(texture(uScene, uv - vec2(px.x, 0.0)).rgb);
    float gy = luma(texture(uScene, uv + vec2(0.0, px.y)).rgb)
             - luma(texture(uScene, uv - vec2(0.0, px.y)).rgb);
    float ink = smoothstep(0.12, 0.40, length(vec2(gx, gy)));
    col *= 1.0 - ink * wl * 0.45;
  }

  /* ---- REALITY BREAK (Strong → Heavy): remap the already fold-tiled scene
     through a vivid cartoon palette so it stays loud & lively instead of
     washing out on dim scenes — image-driven (palette keyed to the scene's own
     luminance), not a pasted overlay. Full takeover at Heavy. ---- */
  float rb = uSig_realityBreak * smoothstep(0.70, 1.0, inten);
  if (rb > 0.004) {
    float y = luma(col);
    /* palette phase = scene luminance + a mouse-centred radial/petal term, so
       even a flat dark scene still gets dense concentric cartoon banding rather
       than one uniform colour (the room-vs-brick washout fix) */
    vec2 d = (uv - uMouse) * vec2(uAspect, 1.0);
    float rad = length(d);
    float ang = atan(d.y, d.x);
    /* fbm turbulence on the phase makes the bands wavy and abstract instead of
       clean concentric rings — less "sharp", more dissolving-reality */
    float turb = fbm(d * 3.0 + uTime * 0.10);
    float phase = y * 1.3 + rad * 2.2 + 0.14 * sin(ang * 8.0 - uTime * 0.2)
                + turb * 0.75 + uTime * 0.03;
    vec3 vivid = pal(phase,
                     vec3(0.55, 0.42, 0.48), vec3(0.55),
                     vec3(1.00, 0.90, 0.65), vec3(0.10, 0.42, 0.72));
    vec3 world = mix(vivid, col, 0.30);           /* keep a little scene hue */
    world = floor(world * 5.0 + 0.5) / 5.0;        /* cartoon posterize */
    float wy = luma(world);
    world = clamp(mix(vec3(wy), world, 1.9), 0.0, 1.3);  /* loud saturation */
    world = mix(world, vec3(0.88, 0.76, 0.24), 0.10);    /* faint salvia yellow */
    col = mix(col, world, rb);
  }
  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
