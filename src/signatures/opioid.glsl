/* Opioid (nod) — "warm, golden, pinholed — the lights keep going out"
   The nod state machine runs on deterministic per-cycle hashes:
   AWAKE → NODDING (lid gradient descends, blur + darkening ramp, frame
   sinks, time thickens) → SNAP (fast retract, brief over-bright) → AWAKE.
   Cycle shortens and deepens with intensity. Constant golden-hour cast +
   pinhole vignette ride underneath. Also: a constant uncontrolled refocus
   (shared doubleVision), hypnagogic dream imagery at the deepest point of a
   Heavy nod, and a slow languid breathe/sway on structure and the pinhole
   boundary at higher doses.
   Params: nodDepth, nodRate, goldenCast, pinhole, dreamImagery, sway */

float nodPeriod(){ return mix(42.0, 9.0, smoothstep(0.1, 1.0, uIntensity) * uSig_nodRate); }

/* returns nod amount 0..1 (1 = lid fully down) with a fast snap release */
float nodPhase(){
  float period = nodPeriod();
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
  float period = nodPeriod();
  float ci = floor(uTime / period);
  float ph = fract(uTime / period) * period;
  float start = period * (0.25 + 0.45 * hash1(ci * 7.31));
  float len = 4.0 + 4.0 * hash1(ci * 3.17);
  return smoothstep(start + len, start + len + 0.3, ph)
       * (1.0 - smoothstep(start + len + 0.3, start + len + 1.1, ph));
}

/* soft, warm, abstract glowing forms — dreamlike, never geometric or
   rainbow-colored (stays in the golden/warm family) */
vec3 opioidDream(vec2 uv, float seed){
  vec2 p = uv * 2.2 + seed * 7.0;
  float f1 = fbm(p + uTime * 0.05);
  float f2 = fbm(p * 1.7 - uTime * 0.035 + 4.0);
  float g = f1 * 0.6 + f2 * 0.4;
  vec3 dreamCol = pal(g * 0.7 + seed * 0.3, vec3(0.45, 0.38, 0.30), vec3(0.40),
                       vec3(1.0, 0.85, 0.55), vec3(0.05, 0.10, 0.08));
  return dreamCol * (0.35 + 0.9 * smoothstep(0.10, 0.80, g));
}

vec2 sigWarp(vec2 uv){
  /* the frame sinks ~2% while nodding */
  uv.y += nodPhase() * 0.02;

  /* slow, dreamy breathe/sway on structure at higher doses — languid, not
     nervous, matching the warm nod identity */
  float bw = uSig_sway * smoothstep(0.4, 1.0, uIntensity);
  if (bw > 0.004) {
    vec2 tang = edgeTangent(uv);
    float mag = edgeAt(uv).z;
    float breathe = sin(uTime * 0.35) * 0.5 + 0.5 * sin(uTime * 0.21 + 1.7);
    uv += tang * (0.3 + 0.7 * mag) * breathe * bw * 0.016;
    uv.x += sin(uTime * 0.18) * 0.0075 * bw;
  }
  return uv;
}

vec3 sigColor(vec3 col, vec2 uv){
  float nod = nodPhase();
  float w = smoothstep(0.05, 0.7, uIntensity);

  /* golden-hour cast */
  col *= mix(vec3(1.0), vec3(1.10, 1.00, 0.80), uSig_goldenCast * w * 0.7);

  /* pinhole vignette: ~80% of frame at Light → ~55% at Heavy; the
     boundary itself gently breathes/sways at higher doses rather than
     sitting perfectly rigid */
  float swayAmt = uSig_sway * smoothstep(0.4, 1.0, uIntensity);
  vec2 c = (uv - 0.5) * vec2(uAspect, 1.0);
  c += vec2(sin(uTime * 0.23) * 0.05, cos(uTime * 0.17) * 0.035) * swayAmt;
  float r = length(c);
  float aperture = mix(0.85, 0.48, smoothstep(0.1, 1.0, uIntensity) * uSig_pinhole)
                 * (1.0 + sin(uTime * 0.30) * 0.08 * swayAmt);
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

  /* hypnagogic dream imagery — only at the deepest point of a Heavy nod,
     fading in and out with the nod depth so it feels discovered inside
     the blackout rather than pasted over it */
  float dreamW = uSig_dreamImagery * smoothstep(0.85, 1.0, uIntensity) * smoothstep(0.5, 0.9, nod);
  if (dreamW > 0.004) {
    float ci = floor(uTime / nodPeriod());
    vec3 dream = opioidDream(uv, hash1(ci * 4.13));
    /* replace toward the dream's own brightness rather than darkening it
       through the already near-black nod color — it should surface as a
       visible vision inside the blackout, not vanish into it */
    col = mix(col, dream, dreamW * 0.8);
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
