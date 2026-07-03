/* P8 — finishing: chromatic aberration, halation/bloom, tone, vignette.
   Ported from ref/phenomenon.html POST (snow/sparkles live in P7 instead).
   Always runs. */

uniform float uP_aberration, uP_bloom, uP_vignette;

void main(){
  vec2 c = vUv - 0.5;
  float r2 = dot(c, c);

  /* subtle live barrel wobble (ported) */
  vec2 uv = 0.5 + c*(1.0 + 0.012*r2*sin(uTime*0.3));

  /* radial chromatic aberration */
  float ab = uP_aberration * (0.002 + 0.014*r2);
  vec3 col;
  col.r = texture(uScene, uv + c*ab).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv - c*ab).b;

  /* halation: squared blur bleed (ported), scaled by bloom weight */
  vec2 px = 3.0 / uRes;
  vec3 blur = texture(uScene, uv+vec2(px.x,0)).rgb + texture(uScene, uv-vec2(px.x,0)).rgb
            + texture(uScene, uv+vec2(0,px.y)).rgb + texture(uScene, uv-vec2(0,px.y)).rgb;
  blur *= 0.25;
  col += blur*blur*(0.10 + uP_bloom*0.55);

  /* tone compression (ported) */
  col = col/(1.0 + col*0.25);

  /* vignette: gentle base falloff + closing tunnel as weight rises */
  float base = 1.0 - 0.18*r2;
  float tun = 1.0 - uP_vignette * smoothstep(0.30 - uP_vignette*0.22, 0.62, r2*2.0);
  col *= clamp(base * tun, 0.0, 1.0);

  fragColor = vec4(col, 1.0);
}
