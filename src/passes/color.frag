/* P4 — color identity: hue drift, saturation, bleed, casts, white-out.
   Signature hook: sigColor(col, uv). M0 stub = passthrough + hooks. */

uniform float uP_colorSat, uP_desat, uP_hueDrift, uP_colorBleed, uP_warmCast,
              uP_coolCast, uP_whiteOut, uP_posterize;

//__SIGNATURE__

void main(){
  vec3 col = scene(vUv);
  col = sigColor(col, vUv);
  fragColor = vec4(col, 1.0);
}
