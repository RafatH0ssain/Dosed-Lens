/* Salvia — "reality re-tiles into copies of itself, something pulls you
   sideways through a seam, and at the peak the room is *replaced* by a flat
   cartoon world of watchers."
   sigWarp:  recursive kaleiFold re-tiling (the scene folds into mirrored
             copies-of-copies), a log-polar seam-shear for the curved lateral
             pull, hard stepped time (~11 fps) and a ~7 s page-turn roll.
   sigColor: Sobel ink lines; then — Heavy only — a reality-break crossfade
             that flattens the *already-folded* scene into a hard cartoon world
             (image-derived, not a pasted graphic) with a sliding row of flat
             dark standing figures (the salvia "beings").
   sigTemporal: —
   Params: foldTile, seamPull, pageTurn, inkLines, realityBreak
   technique ref: Klüver/Bressloff-Cowan form constants; standard polar fold
                  (helpers kaleiFold/logPolar live in passes/common.glsl). */

/* flat standing being: head circle unioned with a body capsule → SDF */
float salviaCapsule(vec2 p, vec2 a, vec2 b, float r){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
float salviaBeing(vec2 q){
  float head = length(q - vec2(0.0, 0.30)) - 0.10;
  float body = salviaCapsule(q, vec2(0.0, 0.16), vec2(0.0, -0.34), 0.11);
  return min(head, body);
}

vec2 sigWarp(vec2 uv){
  float inten = uIntensity;
  /* stepped, lurching time — salvia is abrupt; steps in from Strong */
  float stepAmt = smoothstep(0.55, 1.0, inten);
  float t = mix(uTime, floor(uTime * 11.0) / 11.0, stepAmt);

  vec2 asp = vec2(uAspect, 1.0);
  vec2 p = (uv - 0.5) * asp;

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
     each pass rotated + mildly zoomed, so the scene becomes copies-of-copies.
     Iterations "wake up" one by one as intensity climbs. ---- */
  float tile = uSig_foldTile * smoothstep(0.30, 1.0, inten);
  if (tile > 0.001) {
    float wedges = mix(4.0, 9.0, smoothstep(0.3, 1.0, inten));
    float iters = tile * 3.0;
    for (int i = 0; i < 3; i++) {
      float w = clamp(iters - float(i), 0.0, 1.0);
      if (w < 0.001) break;
      vec2 f = kaleiFold(p, wedges);
      f = rot2(f, 0.35 + t * 0.06 + float(i) * 0.7);
      f *= 1.12;                                     /* zoom → visible recursion */
      p = mix(p, f, w);
    }
  }

  /* ---- page-turn: every ~7 s the whole tiling rolls over ---- */
  float ev = fract(t / 7.0);
  float turn = smoothstep(0.02, 0.16, ev) * (1.0 - smoothstep(0.16, 0.34, ev));
  turn *= uSig_pageTurn * smoothstep(0.4, 1.0, inten);
  p = rot2(p, turn * 0.5);
  p.x += turn * 0.12;

  uv = p / asp + 0.5;
  return uv;
}

vec3 sigColor(vec3 col, vec2 uv){
  float inten = uIntensity;

  /* ink lines: Sobel magnitude as dark cartoon linework */
  float wl = uSig_inkLines * smoothstep(0.35, 0.9, inten);
  if (wl > 0.004) {
    float ink = smoothstep(0.18, 0.55, edgeAt(uv).z);
    col *= 1.0 - ink * wl * 0.75;
  }

  /* ---- REALITY BREAK (Heavy): flatten the already fold-tiled scene into a
     hard cartoon world — image-derived, not a pasted graphic — and stand a
     sliding row of flat dark "beings" in it. The photo is gone because it has
     been folded into an abstract quilt and cartoon-recoloured, not overwritten
     by unrelated geometry. ---- */
  float rb = uSig_realityBreak * smoothstep(0.80, 1.0, inten);
  if (rb > 0.004) {
    float ts = floor(uTime * 11.0) / 11.0;

    /* cartoon push on the folded scene: extra-hard posterize, comic
       saturation, an unnatural channel-rotated hue, a sickly salvia yellow */
    vec3 world = floor(col * 4.0 + 0.5) / 4.0;
    float wy = luma(world);
    world = clamp(mix(vec3(wy), world, 1.7), 0.0, 1.0);
    world = mix(world, world.gbr, 0.15);
    world = mix(world, vec3(0.86, 0.74, 0.20), 0.14);

    /* watchers: a row of flat dark standing figures, tiled across x and
       conveyor-belting sideways with the seam pull */
    float panels = 5.0;
    float fx  = uv.x * uAspect + ts * 0.14;
    float pid = floor(fx * panels);
    float cx  = fract(fx * panels);
    vec2 q;
    q.x = (cx - 0.5) * 1.1 - (hash1(pid * 3.7) - 0.5) * 0.14;
    q.y = uv.y - 0.42;
    float d = salviaBeing(q);
    float being   = smoothstep(0.012, -0.006, d);
    float outline = smoothstep(0.05, 0.012, abs(d));
    world = mix(world, vec3(0.03, 0.02, 0.05), being);
    world = mix(world, vec3(0.0), outline * 0.5);

    col = mix(col, world, rb);
  }
  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
