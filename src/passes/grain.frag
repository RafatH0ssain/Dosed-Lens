/* P7 — stochastic light phenomena. Snow + sparkles ported from
   ref/phenomenon.html POST; scintilla, floaters, starbursts added.
   Gated by: snow, scintilla, floaters, starbursts. */

uniform float uP_snow, uP_scintilla, uP_floaters, uP_starbursts;

void main(){
  vec3 col = scene(vUv);
  float l = luma(col);

  /* ---- visual snow (ported): fine dancing static + rare bright pops ---- */
  if (uP_snow > 0.004) {
    float n = hash12(gl_FragCoord.xy + fract(uTime)*vec2(419.0,157.0));
    col += (n - 0.5) * uP_snow * 0.16;
    float sp = step(0.9985 - uP_snow*0.0015, hash12(floor(gl_FragCoord.xy/1.5) + floor(uTime*24.0)));
    col += sp * uP_snow * 0.6;
  }

  /* ---- scintilla: twinkles riding bright regions ---- */
  if (uP_scintilla > 0.004) {
    float tw = step(0.997, hash12(floor(gl_FragCoord.xy/2.0) + floor(uTime*10.0)*7.3));
    col += tw * uP_scintilla * smoothstep(0.45, 0.8, l) * 0.9;
  }

  /* ---- floaters: a few translucent drifting specks ---- */
  if (uP_floaters > 0.004) {
    vec2 p = vUv * vec2(uAspect, 1.0);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 fp = vec2(
        0.15 + 0.7*hash1(fi*7.3) * uAspect + 0.05*sin(uTime*0.11 + fi*2.7),
        0.2 + 0.6*hash1(fi*3.9) + 0.04*sin(uTime*0.07 + fi*1.3) - 0.015*uTime*0.0
      );
      /* slow sink + wrap, like debris in vitreous humour */
      fp.y = fract(fp.y - uTime*0.004*(0.5 + hash1(fi*11.0)));
      float d = length(p - fp);
      float speck = smoothstep(0.012, 0.002, d);
      col = mix(col, col*0.55, speck * uP_floaters * 0.8);
    }
  }

  /* ---- starbursts: 6-ray flares gathered from nearby bright pixels ---- */
  if (uP_starbursts > 0.004) {
    vec3 acc = vec3(0.0);
    for (int ray = 0; ray < 6; ray++) {
      float a = float(ray) * (PI/3.0);
      vec2 dir = vec2(cos(a), sin(a)) / vec2(uAspect, 1.0);
      for (int s = 1; s <= 5; s++) {
        float fs = float(s) * 0.012;
        vec3 tap = texture(uScene, vUv + dir*fs).rgb;
        float b = max(luma(tap) - 0.72, 0.0);
        acc += tap * b * (1.0 - fs*14.0) * 0.35;
      }
    }
    col += acc * uP_starbursts;
  }

  fragColor = vec4(col, 1.0);
}
