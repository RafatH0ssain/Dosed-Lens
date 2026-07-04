/* Salvia — "reality shears into repeating strips, something pulls sideways,
   and at the peak the room is *replaced* by a flat cartoon world of watchers."
   sigWarp:  diagonal strip shear — N hard-edged bands (3→9 with intensity)
             each sliding along the band axis; ~7 s page-turn events roll
             the bands over and re-tile the field; constant leftward pull.
             Motion time-steps to ~12 fps at Heavy.
   sigColor: Sobel ink lines, then — at Heavy only — a REALITY BREAK crossfade
             that dissolves the photo entirely into a tiled, posterized cartoon
             world: hard rectangular panels conveyor-belting sideways, each
             holding a flat standing figure (the salvia "beings"). Stepped
             12 fps, palette seeded from the image's own dominant colours so it
             reads as *this* place gone fake rather than a generic overlay.
   sigTemporal: —
   Params: stripShear, pageTurn, lateralPull, inkLines, realityBreak */

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

  /* ---- REALITY BREAK: at Heavy the photo dissolves into fake tiled reality,
     more scene-obliterating than DMT's tunnel but in salvia's own idiom —
     hard repeating panels, cartoon-flat colour, a being standing in each. ---- */
  float rb = uSig_realityBreak * smoothstep(0.82, 1.0, uIntensity);
  if (rb > 0.004) {
    /* stepped, lurching time — salvia motion is abrupt, ~12 fps */
    float ts = floor(uTime * 12.0) / 12.0;
    /* the whole fake world conveyor-belts sideways — you are pulled into it */
    float slide = ts * 0.13 + uTime * 0.01;

    /* hard rectangular panels: the stacked "pages" / conveyor belt */
    float panels = 4.0;
    vec2 fp = vec2(uv.x * uAspect + slide, uv.y);
    float pid = floor(fp.x * panels);
    float cx = fract(fp.x * panels);

    /* flat cartoon backdrop seeded from the room's own dominant colours, then
       hard-posterized and pushed to unnatural comic saturation with a sickly
       salvia-yellow bias — the place recognisably *this* place, gone wrong */
    vec3 sky   = mix(uSeedCol[0].rgb, uSeedCol[2].rgb, smoothstep(0.25, 0.85, uv.y));
    vec3 floorc = mix(uSeedCol[1].rgb, uSeedCol[3].rgb, 0.4);
    vec3 base = mix(floorc, sky, smoothstep(0.30, 0.36, uv.y));
    /* rotate channels on alternate panels so the repetition is unmistakable */
    base = mix(base, base.gbr, 0.35 * step(0.5, fract(pid * 0.5)));
    base = floor(base * 4.0 + 0.5) / 4.0;                 /* hard posterize */
    float by = luma(base);
    base = clamp(mix(vec3(by), base, 1.9), 0.0, 1.0);     /* comic saturation */
    base = mix(base, vec3(0.86, 0.74, 0.20), 0.14);       /* salvia yellow cast */

    /* a flat dark being standing in each panel, jittered per panel, watching */
    vec2 q;
    q.x = (cx - 0.5) * 1.1 - (hash1(pid * 3.7) - 0.5) * 0.12;
    q.y = uv.y - 0.42;
    float d = salviaBeing(q);
    float being   = smoothstep(0.012, -0.006, d);
    float outline = smoothstep(0.045, 0.012, abs(d));
    base = mix(base, vec3(0.03, 0.02, 0.04), being);      /* dark flat figure */
    base = mix(base, vec3(0.0), outline * 0.5);           /* ink outline */

    /* thick black page borders between panels */
    float bx = smoothstep(0.0, 0.03, cx) * smoothstep(0.0, 0.03, 1.0 - cx);
    base *= mix(0.08, 1.0, bx);

    col = mix(col, base, rb);
  }
  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
