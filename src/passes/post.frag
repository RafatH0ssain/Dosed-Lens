/* P8 — chromatic aberration, bloom, vignette, tone (port in M2).
   Always runs. M0 stub = passthrough. */

uniform float uP_aberration, uP_bloom, uP_vignette;

void main(){
  fragColor = vec4(scene(vUv), 1.0);
}
