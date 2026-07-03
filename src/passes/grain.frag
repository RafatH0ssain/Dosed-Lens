/* P7 — visual snow, scintilla, floaters, starbursts.
   Gated by: snow, scintilla, floaters, starbursts. M0 stub = passthrough. */

uniform float uP_snow, uP_scintilla, uP_floaters, uP_starbursts;

void main(){
  fragColor = vec4(scene(vUv), 1.0);
}
