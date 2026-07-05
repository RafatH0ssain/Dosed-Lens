/* MDMA — "lights bloom into stars and your eyes wiggle"
   sigWarp:  nystagmus — episodic, gently-eased horizontal micro-
             oscillation in short bursts with randomized onsets (never
             constant); kept soft/subtle per user feedback rather than a
             sharp snap.
   sigColor: magenta-biased warmth + fine shimmer on bright regions
             (starbursts + halos come from the shared P7/P8 params, pushed
             harder at Heavy). A faint, dim, monotone blue-grey geometric
             layer rides the shared pattern pass at Strong+ — PsychonautWiki
             describes MDMA geometry as "more similar to psilocin than LSD
             ...intricate, abstract, organic, dimly lit, primarily monotone
             blues and greys" — kept deliberately low-weight, a hint, not a
             transformation.
   Heavy: shared late doubleVision + low-weight peripheral shadow flicker
   via the particle layer (shadowFlicker param).
   Params: starRays, magenta, shimmer, nystagmus, shadowFlicker
   sources: psychonautwiki:mdma */

float mdmaBurst(){
  /* each 2.2 s slot may contain one soft wiggle burst */
  float slot = floor(uTime / 2.2);
  float tIn = fract(uTime / 2.2);
  float onset = 0.1 + 0.5 * hash1(slot * 3.71);
  float gate = step(hash1(slot * 7.13), smoothstep(0.3, 1.0, uIntensity) * 0.75);
  /* wide, soft attack/release — an eased drift into and out of the wiggle
     rather than a sharp snap; widened further per user feedback (still
     too quick) */
  return gate * smoothstep(onset, onset + 0.22, tIn)
              * (1.0 - smoothstep(onset + 0.30, onset + 0.55, tIn));
}

vec2 sigWarp(vec2 uv){
  float b = mdmaBurst() * uSig_nystagmus;
  if (b > 0.004) {
    uv.x += sin(uTime * TAU * 5.0) * 0.0018 * b;
  }
  return uv;
}

vec3 sigColor(vec3 col, vec2 uv){
  float w = smoothstep(0.1, 0.7, uIntensity);
  /* magenta-biased lift, stronger through the tiers */
  col *= mix(vec3(1.0), vec3(1.10, 0.95, 1.07), uSig_magenta * w);

  /* fine fast shimmer riding bright regions */
  float l = luma(col);
  float sh = uSig_shimmer * smoothstep(0.45, 0.95, uIntensity);
  if (sh > 0.004) {
    float d = sin(uTime * TAU * 30.0 + hash12(floor(uv * uRes / 2.0)) * TAU);
    col *= 1.0 + d * 0.05 * sh * smoothstep(0.45, 0.75, l);
  }

  /* Heavy: extra color lift so the starburst/bloom stack reads as a real
     peak rather than "same as Strong, slightly more" */
  float heavyW = smoothstep(0.75, 1.0, uIntensity);
  col = mix(col, vec3(0.5) + (col - vec3(0.5)) * 1.14, heavyW * 0.6);
  col *= 1.0 + heavyW * 0.05;
  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
