/* DPH / deliriant — "not colorful — *wrong*. Spiders in the corners and
   smoke in the room" ⚠ gated
   No fractal/kaleidoscope geometry, no rainbow — deliberately. The
   wrongness is tonal, peripheral, and — per PsychonautWiki — genuinely
   structural: real anticholinergic reports include "drifting (melting,
   breathing, morphing, flowing)... intricate yet faint, jittery and
   flexible in motion, static in permanence, realistic in believability"
   and double vision at moderate-heavy doses. sigWarp was previously a
   no-op, which is why the image read as an unchanged overlay — this
   fixes that with a faint, structure-driven drift (edge-tangent, like
   LSD's, but far subtler/higher-frequency and colorless) rather than any
   pattern or lattice.
   sigColor:    darken, sickly sepia-green cast, slow 0.1 Hz blur *waves*
   sigTemporal: shadow pareidolia — in the darkest image regions, barely-
                visible faces fade in and dissolve when the mouse (gaze)
                approaches
   Skitter clusters, smoke wisps, and the Heavy "someone standing there"
   figure events live in the CPU particle layer.
   Params: sepiaGreen, blurWave, skitter, smoke, pareidolia, figureEvents,
   drift
   sources: psychonautwiki:diphenhydramine */

vec2 sigWarp(vec2 uv){
  float w = uSig_drift * smoothstep(0.12, 0.85, uIntensity);
  if (w > 0.004) {
    vec2 tang = edgeTangent(uv);
    float mag = edgeAt(uv).z;
    /* slow organic wobble along the structure — "faint... realistic in
       believability", never a smooth LSD-style flow */
    float slow = fbm(uv * 4.0 + uTime * 0.045) - 0.5;
    uv += tang * mag * slow * w * 0.0075;
    /* fine, fast jitter — "jittery and flexible in motion" — independent
       of edges so it also touches flat regions faintly */
    vec2 j = vec2(hash12(floor(uv * uRes * 0.5) + floor(uTime * 10.0) * 1.7) - 0.5,
                  hash12(floor(uv * uRes * 0.5) + floor(uTime * 10.0) * 2.3) - 0.5);
    uv += j * w * 0.0016;
  }
  return uv;
}

vec3 sigColor(vec3 col, vec2 uv){
  float w = smoothstep(0.1, 0.75, uIntensity);

  /* sickly cast + darkening */
  col *= mix(vec3(1.0), vec3(0.86, 0.88, 0.72), uSig_sepiaGreen * w);
  col *= 1.0 - 0.18 * w;

  /* slow blur waves — acuity swims on a 0.1 Hz cycle */
  float bw = uSig_blurWave * smoothstep(0.3, 0.85, uIntensity)
           * (0.5 + 0.5 * sin(uTime * TAU * 0.1));
  if (bw > 0.02) {
    vec2 px = 8.0 * bw / uRes;
    vec3 soft = ( texture(uScene, uv + px).rgb + texture(uScene, uv - px).rgb
                + texture(uScene, uv + vec2(px.x, -px.y)).rgb
                + texture(uScene, uv - vec2(px.x, -px.y)).rgb ) * 0.25;
    col = mix(col, soft, bw);
  }
  return col;
}

/* a barely-there face: two eye hollows + a mouth hollow, drawn as gentle
   luminance dents (pareidolia, not a portrait) */
float dphFace(vec2 q){
  float eL = length((q - vec2(-0.30, 0.18)) * vec2(1.0, 1.7));
  float eR = length((q - vec2( 0.30, 0.18)) * vec2(1.0, 1.7));
  float mo = length((q - vec2( 0.00, -0.35)) * vec2(0.8, 1.9));
  return smoothstep(0.24, 0.05, eL) + smoothstep(0.24, 0.05, eR)
       + smoothstep(0.30, 0.08, mo) * 0.8;
}

vec3 sigTemporal(vec3 col, vec2 uv){
  float w = uSig_pareidolia * smoothstep(0.5, 0.9, uIntensity);
  if (w > 0.004) {
    vec2 asp = vec2(uAspect, 1.0);
    /* only the darkest image regions can hold a face */
    float dark = 1.0 - smoothstep(0.08, 0.28, lumAt(uv, 4.0));
    if (dark > 0.05) {
      for (int i = 0; i < 2; i++) {
        float fi = float(i);
        /* slow-wandering anchor, re-seats every ~40 s */
        float epoch = floor(uTime / 40.0) + fi * 7.0;
        vec2 anchor = vec2(0.18 + 0.64 * hash1(epoch * 3.1 + fi),
                           0.25 + 0.5 * hash1(epoch * 7.7 + fi * 2.0));
        /* long fade in and out, out of step per face */
        float vis = smoothstep(0.25, 0.8, 0.5 + 0.5 * sin(uTime * 0.05 + fi * 2.6));
        /* the gaze dissolves it */
        vis *= smoothstep(0.10, 0.28, distance(anchor, uMouse));
        vec2 q = (uv - anchor) * asp / 0.13;
        if (dot(q, q) < 1.8) {
          float f = dphFace(q);
          /* darker-than-dark hollows, faintly desaturated */
          col = mix(col, col * 0.55 + vec3(0.01), f * 0.10 * w * dark * vis);
        }
      }
    }
  }
  return col;
}
