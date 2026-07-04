/* LSD — "sharper than reality, geometry living in textures"
   sigWarp:     edge-tangent drift — lines crawl along themselves, slower and
                more coherent than the shared flowWarp wave
   sigColor:    "HD" mip-difference unsharp halo + extra saturation bite;
                Heavy adds fractal tiling (kaleidoscopically folded scene
                copies blended where texture energy is high)
   sigTemporal: rainbow trails — feedback hue-advanced ~12°/frame so motion
                leaves spectral smears
   Params: hdSharpen, fractalTile, rainbowTrail */

vec2 lsdFold(vec2 p, float n){
  float a = atan(p.y, p.x);
  float seg = TAU / n;
  a = mod(a, seg);
  a = abs(a - seg*0.5);
  return vec2(cos(a), sin(a)) * length(p);
}

vec2 sigWarp(vec2 uv){
  vec4 e = edgeAt(uv);
  vec2 tan1 = vec2(-(e.y*2.0-1.0), e.x*2.0-1.0);
  float w = sin(uTime*0.35 + fbm(uv*4.0)*3.0)*0.7
          + sin(uTime*0.13 + fbm(uv*2.0 + 9.0)*2.0 + 1.1)*0.3;
  uv += tan1 * e.z * w * uIntensity * 0.006;
  return uv;
}

vec3 sigColor(vec3 col, vec2 uv){
  /* HD unsharp halo from the luminance pyramid (high mip − low mip) */
  float hd = lumAt(uv, 1.0) - lumAt(uv, 4.0);
  col += clamp(vec3(hd), -0.28, 0.28) * uSig_hdSharpen * (0.35 + 0.65*uIntensity);
  /* saturation bite on top of the shared push */
  float l = luma(col);
  col = mix(vec3(l), col, 1.0 + 0.25*uSig_hdSharpen*uIntensity);

  /* fractal tiling — Heavy only: the repeating-texture effect */
  float heavy = smoothstep(0.72, 1.0, uIntensity) * uSig_fractalTile;
  if (heavy > 0.004) {
    vec2 asp = vec2(uAspect, 1.0);
    vec2 ctr = uMouse;                 /* fractal-tiling centre follows the cursor */
    vec2 p = (uv - ctr) * asp;
    vec2 k1 = lsdFold(rot2(p, uTime*0.02), 6.0) / asp + ctr;
    vec2 k2 = lsdFold(rot2(p, -uTime*0.013 + 0.7), 8.0) / asp + ctr;
    vec3 c1 = texture(uScene, clamp(k1, 0.0, 1.0)).rgb;
    vec3 c2 = texture(uScene, clamp(k2, 0.0, 1.0)).rgb;
    float texE = smoothstep(0.015, 0.10, abs(lumAt(uv, 2.0) - lumAt(uv, 5.0)));
    col = mix(col, (c1 + c2) * 0.5, heavy * texE * 0.65);
  }
  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){
  float w = uSig_rainbowTrail * smoothstep(0.18, 0.6, uIntensity);
  if (w > 0.004) {
    /* +12°/frame spectral advance on the feedback history */
    vec3 prev = texture(uPrev, uv).rgb;
    prev = hueRot(prev, 0.21 * uSig_rainbowTrail);
    col = mix(col, max(col, prev * 0.972), 0.45 * w);
  }
  return col;
}
