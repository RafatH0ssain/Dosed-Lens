/* Cannabis — "subtle: warmer, laggier, halos, time hiccups" (realism floor)
   sigTemporal: time hiccup — a 120–250 ms frame hold every 4–9 s,
                organic and unsettling rather than rhythmic
   sigColor:    gentle warm/red lift, slight contrast drop
   sigWarp:     peripheral-only micro-breathing (center stays honest)
   Params: hiccup, peripheralOnly, redShift */

vec2 sigWarp(vec2 uv){
  float w = smoothstep(0.55, 1.0, uIntensity) * uSig_peripheralOnly;
  if (w > 0.004) {
    vec2 c = (uv - 0.5) * vec2(uAspect, 1.0);
    float r = length(c);
    float mask = smoothstep(0.35, 0.75, r);
    float breathe = sin(uTime * 0.5 + r * 5.0) * 0.010
                  + sin(uTime * 0.21 + atan(c.y, c.x) * 2.0) * 0.004;
    uv -= (c / max(r, 1e-4)) * breathe * mask * w / vec2(uAspect, 1.0);
  }
  return uv;
}

vec3 sigColor(vec3 col, vec2 uv){
  float w = smoothstep(0.08, 0.6, uIntensity);
  /* warm red-shifted lift + soft contrast drop */
  col *= mix(vec3(1.0), vec3(1.05, 0.99, 0.94), uSig_redShift * w);
  col = mix(col, vec3(0.5) + (col - vec3(0.5)) * 0.93, w * 0.6);
  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){
  /* time hiccup: irregular hold, then life resumes */
  float w = uSig_hiccup * smoothstep(0.32, 0.75, uIntensity);
  if (w > 0.004) {
    float slot = floor(uTime / 5.5);
    float tIn = fract(uTime / 5.5) * 5.5;
    float start = 0.5 + 4.0 * hash1(slot * 11.3);   /* when in the slot */
    float len = 0.12 + 0.13 * hash1(slot * 5.7);    /* 120–250 ms */
    float gate = step(hash1(slot * 3.3), 0.85);     /* most slots hiccup */
    if (gate > 0.5 && tIn > start && tIn < start + len) {
      col = mix(col, texture(uPrev, uv).rgb, w);
    }
  }
  return col;
}
