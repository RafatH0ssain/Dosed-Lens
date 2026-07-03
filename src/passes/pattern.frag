/* P3 — form constants + entities, masked into the photo by luminance/edges.
   Ported from ref/phenomenon.html in M2. M0 stub = passthrough.
   Gated by: patternMask. */

uniform float uP_patternMask, uP_symmetry;

void main(){
  fragColor = vec4(scene(vUv), 1.0);
}
