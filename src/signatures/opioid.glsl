/* Opioid (nod) — "warm, golden, pinholed — the lights keep going out"
   The nod state machine runs on deterministic per-cycle hashes:
   AWAKE → NODDING (lid gradient descends, blur + darkening ramp, frame
   sinks, time thickens) → SNAP (fast retract, brief over-bright) → AWAKE.
   Cycle shortens and deepens with intensity. Constant golden-hour cast +
   pinhole vignette ride underneath.
   Params: nodDepth, nodRate, goldenCast, pinhole */

/* returns nod amount 0..1 (1 = lid fully down) with a fast snap release */
float nodPhase(){
  float period = mix(42.0, 9.0, smoothstep(0.1, 1.0, uIntensity) * uSig_nodRate);
  float ci = floor(uTime / period);
  float ph = fract(uTime / period) * period; /* seconds into cycle */
  float start = period * (0.25 + 0.45 * hash1(ci * 7.31));
  float len = 4.0 + 4.0 * hash1(ci * 3.17);  /* 4–8 s nod */
  /* slow descend over 70% of the nod, hold, then 0.3 s snap back */
  float down = smoothstep(start, start + len * 0.7, ph);
  float up = 1.0 - smoothstep(start + len, start + len + 0.3, ph);
  float depth = (0.45 + 0.55 * hash1(ci * 9.73))
              * uSig_nodDepth * smoothstep(0.18, 1.0, uIntensity);
  return down * up * depth;
}
/* brief over-bright pulse right after the snap */
float snapPulse(){
  float period = mix(42.0, 9.0, smoothstep(0.1, 1.0, uIntensity) * uSig_nodRate);
  float ci = floor(uTime / period);
  float ph = fract(uTime / period) * period;
  float start = period * (0.25 + 0.45 * hash1(ci * 7.31));
  float len = 4.0 + 4.0 * hash1(ci * 3.17);
  return smoothstep(start + len, start + len + 0.3, ph)
       * (1.0 - smoothstep(start + len + 0.3, start + len + 1.1, ph));
}

vec2 sigWarp(vec2 uv){
  /* the frame sinks ~2% while nodding */
  uv.y += nodPhase() * 0.02;
  return uv;
}

vec3 sigColor(vec3 col, vec2 uv){
  float nod = nodPhase();
  float w = smoothstep(0.05, 0.7, uIntensity);

  /* golden-hour cast */
  col *= mix(vec3(1.0), vec3(1.10, 1.00, 0.80), uSig_goldenCast * w * 0.7);

  /* pinhole vignette: ~80% of frame at Light → ~55% at Heavy */
  vec2 c = (uv - 0.5) * vec2(uAspect, 1.0);
  float r = length(c);
  float aperture = mix(0.85, 0.48, smoothstep(0.1, 1.0, uIntensity) * uSig_pinhole);
  col *= 1.0 - smoothstep(aperture * 0.55, aperture, r) * 0.9;

  /* nod: upper-lid gradient descends + blur + darkening */
  if (nod > 0.004) {
    float lidEdge = 1.0 - nod * 1.25;                /* lid line comes down */
    float lid = smoothstep(lidEdge + 0.02, lidEdge - 0.18, uv.y);
    vec2 px = 7.0 * nod / uRes;
    vec3 soft = ( texture(uScene, uv + px).rgb + texture(uScene, uv - px).rgb
                + texture(uScene, uv + vec2(px.x, -px.y)).rgb
                + texture(uScene, uv - vec2(px.x, -px.y)).rgb ) * 0.25;
    col = mix(col, soft, min(nod * 1.3, 1.0));
    col *= 1.0 - lid * 0.96;
    col *= 1.0 - nod * 0.35; /* global dim on top */
  }

  /* snap: brief over-bright refocus */
  col *= 1.0 + snapPulse() * 0.14;
  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){
  /* time slows during the nod — heavy mix toward history */
  float nod = nodPhase();
  if (nod > 0.004) {
    col = mix(col, texture(uPrev, uv).rgb, min(nod * 0.65, 0.9));
  }
  return col;
}
