/* P2 — geometric distortion. Pipeline entry: samples uSrc with cover-fit.
   Shared warps: breathing, drift, flowWarp, doubleVision, jitter, sway.
   Signature hook: sigWarp(uv). M0 stub = cover-fit passthrough. */

uniform float uP_breathing, uP_drift, uP_flowWarp, uP_doubleVision, uP_jitter, uP_sway;

//__SIGNATURE__

void main(){
  vec2 uv = vUv;
  uv = sigWarp(uv);
  vec3 col = texture(uSrc, fitUV(uv)).rgb;
  fragColor = vec4(col, 1.0);
}
