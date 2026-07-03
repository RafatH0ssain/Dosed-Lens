/* P5 — time domain. Feedback tracer core ported from ref/phenomenon.html:
   uPrev is this pass's own previous output (pre-post, so vignette/grain
   never accumulate). The ported rotate/shrink feedback UV gives tracers
   their characteristic inward smear; hue-rotating the history tints
   trails; `max` blend keeps bright afterimages alive.
   echo    — blend of the history frame (nitrous flange base)
   stutter — quantized-time frame holds (ketamine/salvia/cannabis)
   Signature hook: sigTemporal(col, uv) runs before shared feedback. */

uniform float uP_tracers, uP_echo, uP_stutter, uP_hueDrift;

//__SIGNATURE__

void main(){
  vec3 col = scene(vUv);
  col = sigTemporal(col, vUv);

  /* ---- ported feedback tracers ---- */
  if (uP_tracers > 0.004) {
    vec2 fbUV = vUv - 0.5;
    float fa = 0.0035*sin(uTime*0.4);
    fbUV = rot2(fbUV, fa);
    fbUV *= 0.9965 - 0.0030*sin(uTime*0.5);
    fbUV += 0.5;
    vec3 prev = texture(uPrev, fbUV).rgb;
    prev = hueRot(prev, 0.02 + 0.05*uP_hueDrift);
    col = mix(col, max(col, prev*0.985), uP_tracers);
  }

  /* ---- echo: flat blend of history (throb/flange base) ---- */
  if (uP_echo > 0.004) {
    col = mix(col, texture(uPrev, vUv).rgb, uP_echo * 0.45);
  }

  /* ---- stutter: hold the previous frame in quantized time slots ---- */
  if (uP_stutter > 0.004) {
    float slot = floor(uTime * 6.0);
    if (hash1(slot * 1.618) < uP_stutter * 0.7) {
      col = texture(uPrev, vUv).rgb;
    }
  }

  fragColor = vec4(col, 1.0);
}
