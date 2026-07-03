/* P5 — time domain: feedback tracers, frame echo, stutter (port in M2).
   Signature hook: sigTemporal(col, uv). M0 stub = passthrough + hooks. */

uniform float uP_tracers, uP_echo, uP_stutter;

//__SIGNATURE__

void main(){
  vec3 col = scene(vUv);
  col = sigTemporal(col, vUv);
  fragColor = vec4(col, 1.0);
}
