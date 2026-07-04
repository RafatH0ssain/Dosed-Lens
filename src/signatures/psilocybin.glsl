/* Psilocybin — "the world melts and flows, organic and earthy"
   sigWarp:  melt — content slumps downward by the persistent uFlow
             accumulator (slow build, elastic recovery, ~20 s regional
             cycle) + water-ripple rings emanating from the image's
             brightest point
   sigColor: hue pull toward olive/amber, soft glow on organic
             (low-edge-density) regions
   sigTemporal: shared tracers carry it — soft and long, no rainbow
   Params: meltRate, rippleAmp, earthHue, organicGlow */

vec2 sigWarp(vec2 uv){
  /* melt: sample above → content appears slumped downward */
  float m = texture(uFlow, uv).r;
  float w = smoothstep(0.28, 1.0, uIntensity);
  uv.y += m * w * uSig_meltRate * 0.045;

  /* water ripple from the brightest region */
  float rw = uSig_rippleAmp * smoothstep(0.4, 0.9, uIntensity);
  if (rw > 0.004) {
    vec2 asp = vec2(uAspect, 1.0);
    vec2 d = (uv - uBright) * asp;
    float r = length(d) + 1e-4;
    float ring = sin(r * 52.0 - uTime * 2.6) * exp(-r * 2.2);
    uv += (d / r) * ring * rw * 0.004 / asp;
  }
  return uv;
}

vec3 sigColor(vec3 col, vec2 uv){
  float w = smoothstep(0.08, 0.8, uIntensity);
  /* earth-hue convergence: nudge everything toward olive/amber */
  vec3 target = luma(col) * vec3(1.10, 0.98, 0.62);
  col = mix(col, target, 0.28 * uSig_earthHue * w);
  col = hueRot(col, 0.06 * uSig_earthHue * w);

  /* organic glow: soft light where the image is smooth (low edge density) */
  float density = smoothstep(0.25, 0.02, edgeAt(uv).z);
  col += col * density * 0.18 * uSig_organicGlow * w;
  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
