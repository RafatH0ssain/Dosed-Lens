/* P6 — acuity: blur fields, ghosting, sharpen-halo, DoF collapse.
   Gated by: acuity, sharpenHalo, ghosting, dof. M0 stub = passthrough. */

uniform float uP_acuity, uP_sharpenHalo, uP_ghosting, uP_dof;

void main(){
  fragColor = vec4(scene(vUv), 1.0);
}
