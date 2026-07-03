/* Alcohol — "double vision, lag, and eventually the spins"
   sigWarp:     Heavy: the spins — continuous ~0.5 rpm roll of the whole
                frame (shared sway/doubleVision carry the hunting diplopia
                and horizon sway from Light up)
   sigColor:    warm flush + radial nausea blur while spinning
   sigTemporal: pan-lag smear — history blended at 0.25 so any motion
                streaks behind itself
   Params: hunting, spins, flush */

float spinW(){ return uSig_spins * smoothstep(0.78, 1.0, uIntensity); }

vec2 sigWarp(vec2 uv){
  float s = spinW();
  if (s > 0.004) {
    vec2 asp = vec2(uAspect, 1.0);
    /* 0.5 rpm ≈ 0.052 rad/s, plus a drunken wobble on top */
    float ang = -uTime * 0.052 * s + 0.02 * s * sin(uTime * 0.9);
    uv = rot2((uv - 0.5) * asp, ang) / asp + 0.5;
  }
  return uv;
}

vec3 sigColor(vec3 col, vec2 uv){
  /* warm flush, strongest low in the frame (cheeks-up look) */
  float fl = uSig_flush * smoothstep(0.10, 0.60, uIntensity);
  col *= mix(vec3(1.0), vec3(1.07, 0.99, 0.93), fl * (0.7 + 0.3 * (1.0 - uv.y)));

  /* radial nausea blur once the spins start */
  float s = spinW();
  if (s > 0.004) {
    vec2 c = uv - 0.5;
    vec2 dir = c * 0.030 * s;
    vec3 r1 = texture(uScene, uv - dir).rgb;
    vec3 r2 = texture(uScene, uv - dir * 2.0).rgb;
    col = mix(col, (col + r1 + r2) / 3.0, min(s * 1.2, 1.0));
  }
  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){
  /* pan-lag smear: eyes drag behind the world */
  float lag = smoothstep(0.22, 0.80, uIntensity) * (0.5 + 0.5 * uSig_hunting);
  if (lag > 0.004) {
    vec3 prev = texture(uPrev, uv).rgb;
    col = mix(col, prev, 0.25 * lag);
  }
  return col;
}
