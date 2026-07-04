/* MDMA — "lights bloom into stars and your eyes wiggle"
   sigWarp:  nystagmus — episodic 8 Hz horizontal micro-oscillation in
             ~0.3 s bursts with randomized onsets (never constant)
   sigColor: magenta-biased warmth + 30 Hz fine shimmer on bright regions
             (starbursts + halos come from the shared P7/P8 params)
   Heavy: shared late doubleVision + low-weight peripheral shadow flicker
   via the particle layer (shadowFlicker param).
   Params: starRays, magenta, shimmer, nystagmus, shadowFlicker */

float mdmaBurst(){
  /* each 2.2 s slot may contain one 0.3 s wiggle burst */
  float slot = floor(uTime / 2.2);
  float tIn = fract(uTime / 2.2);
  float onset = 0.1 + 0.5 * hash1(slot * 3.71);
  float gate = step(hash1(slot * 7.13), smoothstep(0.3, 1.0, uIntensity) * 0.75);
  return gate * smoothstep(onset, onset + 0.04, tIn)
              * (1.0 - smoothstep(onset + 0.26, onset + 0.32, tIn));
}

vec2 sigWarp(vec2 uv){
  float b = mdmaBurst() * uSig_nystagmus;
  if (b > 0.004) {
    uv.x += sin(uTime * TAU * 8.0) * 0.0042 * b;
  }
  return uv;
}

vec3 sigColor(vec3 col, vec2 uv){
  float w = smoothstep(0.1, 0.7, uIntensity);
  /* magenta-biased lift */
  col *= mix(vec3(1.0), vec3(1.07, 0.96, 1.05), uSig_magenta * w);

  /* fine fast shimmer riding bright regions */
  float l = luma(col);
  float sh = uSig_shimmer * smoothstep(0.45, 0.95, uIntensity);
  if (sh > 0.004) {
    float d = sin(uTime * TAU * 30.0 + hash12(floor(uv * uRes / 2.0)) * TAU);
    col *= 1.0 + d * 0.045 * sh * smoothstep(0.45, 0.75, l);
  }
  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
