/* LSD — "sharper than reality, geometry living in textures"
   sigWarp:     edge-tangent drift — lines crawl along themselves
   sigColor:    "HD" mip-difference unsharp halo + saturation bite; Heavy folds
                the scene into a living recursive fractal lattice
   sigTemporal: rainbow trails — feedback hue-advanced so motion smears spectrally
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
  float swim = 1.0 + 1.4 * smoothstep(0.7, 1.0, uIntensity);   /* Heavy: lines swim ~2.4x harder */
  uv += tan1 * e.z * w * uIntensity * 0.006 * swim;
  return uv;
}

vec3 sigColor(vec3 col, vec2 uv){
  /* HD unsharp halo from the luminance pyramid (high mip − low mip) */
  float hd = lumAt(uv, 1.0) - lumAt(uv, 4.0);
  col += clamp(vec3(hd), -0.36, 0.36) * uSig_hdSharpen * (0.30 + 0.85*uIntensity);
  float l = luma(col);
  col = mix(vec3(l), col, 1.0 + 0.40*uSig_hdSharpen*uIntensity);

  /* fractal tiling — the reality-bend. At the deep end it becomes a living,
     recursive fold: the scene is kaleidoscopically folded onto itself, that
     fold is folded again (self-similar lattice), and the field is domain-warped
     so it swims. The photo's own content/colour tiles — no tunnel, no entities. */
  float heavy = smoothstep(0.52, 0.90, uIntensity) * uSig_fractalTile;
  if (heavy > 0.004) {
    float deep = smoothstep(0.80, 1.0, uIntensity);
    vec2 asp = vec2(uAspect, 1.0);
    vec2 ctr = uMouse;                 /* fold centre follows the cursor */
    vec2 p = (uv - ctr) * asp;
    float t = uTime * 0.05;
    p += 0.06 * (0.5 + deep) * vec2(fbm(p*3.0 + t), fbm(p*3.0 - t + 4.0));
    vec2 k1 = lsdFold(rot2(p, uTime*0.02), 6.0);
    vec2 k2 = lsdFold(rot2(k1*1.3, -uTime*0.013 + 0.7), 8.0 + 4.0*deep) / asp + ctr;
    k1 = k1 / asp + ctr;
    vec3 fold = (texture(uScene, clamp(k1, 0.0, 1.0)).rgb
               + texture(uScene, clamp(k2, 0.0, 1.0)).rgb) * 0.5;
    fold = mix(vec3(luma(fold)), fold, 1.25);
    /* hue varies across the folded field so the lattice reads rainbow, not a
       monochrome radial tunnel */
    fold = hueRot(fold, (0.10 + 0.34*fbm(k1*2.3)) * (0.4 + deep));
    float texE = smoothstep(0.015, 0.10, abs(lumAt(uv, 2.0) - lumAt(uv, 5.0)));
    texE = mix(texE, 1.0, 0.35 * deep);   /* relax the gate but keep dark regions from voiding */
    col = mix(col, fold, heavy * texE * mix(0.90, 0.96, deep));
  }
  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){
  float w = uSig_rainbowTrail * smoothstep(0.18, 0.6, uIntensity);
  if (w > 0.004) {
    /* spectral advance on the feedback history; longer/further at Heavy */
    float deep = smoothstep(0.7, 1.0, uIntensity);
    vec3 prev = texture(uPrev, uv).rgb;
    prev = hueRot(prev, (0.21 + 0.15*deep) * uSig_rainbowTrail);
    col = mix(col, max(col, prev * (0.972 + 0.02*deep)), (0.45 + 0.30*deep) * w);
  }
  return col;
}
