/* Salvia — "reality shears into repeating strips, something pulls sideways"
   sigWarp:  diagonal strip shear — N hard-edged bands (3→9 with intensity)
             each sliding along the band axis; ~7 s page-turn events roll
             the bands over and re-tile the field; constant leftward pull.
             Motion time-steps to ~12 fps at Heavy.
   sigColor: Sobel ink lines (posterize comes from the shared param)
   sigTemporal: —
   Params: stripShear, pageTurn, lateralPull, inkLines */

vec2 sigWarp(vec2 uv){
  float w = uSig_stripShear * smoothstep(0.12, 0.85, uIntensity);
  /* stepped time: sneaks in from Strong, full 12 fps at Heavy */
  float stepAmt = smoothstep(0.72, 1.0, uIntensity);
  float t = mix(uTime, floor(uTime * 12.0) / 12.0, stepAmt);

  /* constant lateral gravity — the whole field wants to go left */
  float pull = uSig_lateralPull * smoothstep(0.02, 0.6, uIntensity);
  uv.x -= pull * (0.015 + 0.02 * sin(t * 0.23));
  uv.x -= pull * (uv.y - 0.5) * 0.05; /* slight skew, floor pulls harder */

  if (w > 0.004) {
    vec2 asp = vec2(uAspect, 1.0);
    vec2 p = (uv - 0.5) * asp;
    vec2 axis = normalize(vec2(1.0, 0.38));   /* band direction */
    vec2 nrm = vec2(-axis.y, axis.x);         /* across bands */

    float bands = floor(mix(3.0, 9.0, smoothstep(0.15, 0.95, uIntensity)));
    float coord = dot(p, nrm) * bands + 0.5;

    /* page-turn event every ~7 s: bands roll over with a cosine flip and
       the field re-tiles with one duplicated band */
    float ev = fract(t / 7.0);
    float turn = smoothstep(0.02, 0.16, ev) * (1.0 - smoothstep(0.16, 0.34, ev));
    turn *= uSig_pageTurn;
    coord += turn * (1.0 - cos(PI * fract(coord))) * 0.8;

    float idx = floor(coord);
    /* hard-edged per-band slide along the band axis */
    float slide = (hash1(idx * 7.31) - 0.5) * 0.9
                + sin(t * 0.45 + idx * 1.7) * 0.55
                + idx * 0.10 * sin(t * 0.12);
    p += axis * slide * w * 0.05;
    /* during the turn, bands also separate slightly across the axis */
    p += nrm * turn * sin(idx * 2.3 + t) * 0.02;

    uv = p / asp + 0.5;
  }
  return uv;
}

vec3 sigColor(vec3 col, vec2 uv){
  /* ink lines: Sobel magnitude as dark cartoon linework */
  float w = uSig_inkLines * smoothstep(0.35, 0.9, uIntensity);
  if (w > 0.004) {
    float ink = smoothstep(0.18, 0.55, edgeAt(uv).z);
    col *= 1.0 - ink * w * 0.75;
  }
  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
