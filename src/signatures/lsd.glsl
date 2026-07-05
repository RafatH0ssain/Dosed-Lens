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
  /* Heavy: lines swim far harder along themselves (up to ~2.4× the base
     tangent drift) so surfaces genuinely crawl rather than gently bowing —
     part of the "Heavy needs to bend reality" ask. */
  float swim = 1.0 + 1.4 * smoothstep(0.7, 1.0, uIntensity);
  uv += tan1 * e.z * w * uIntensity * 0.006 * swim;
  return uv;
}

vec3 sigColor(vec3 col, vec2 uv){
  /* HD unsharp halo from the luminance pyramid (high mip − low mip) —
     feedback: Heavy needed to be much stronger, so both the clamp range
     and its intensity ramp are wider now */
  float hd = lumAt(uv, 1.0) - lumAt(uv, 4.0);
  col += clamp(vec3(hd), -0.36, 0.36) * uSig_hdSharpen * (0.30 + 0.85*uIntensity);
  /* saturation bite on top of the shared push */
  float l = luma(col);
  col = mix(vec3(l), col, 1.0 + 0.40*uSig_hdSharpen*uIntensity);

  /* fractal tiling — the reality-bend. Onset earlier (0.52); at the deep end
     it becomes a *living, recursive* fold: the scene is kaleidoscopically
     folded onto itself, that fold is folded again (self-similar lattice),
     and the whole field is domain-warped so it swims instead of sitting like
     a static mirror. Distinct from DMT: the photo's own content/colour is
     what tiles — no tunnel, no entities — just reality folding into itself. */
  float heavy = smoothstep(0.52, 0.90, uIntensity) * uSig_fractalTile;
  if (heavy > 0.004) {
    float deep = smoothstep(0.80, 1.0, uIntensity);   // extra Heavy escalation
    vec2 asp = vec2(uAspect, 1.0);
    vec2 ctr = uMouse;                 /* fractal-tiling centre follows the cursor */
    vec2 p = (uv - ctr) * asp;
    /* domain-warp the fold coords so the lattice breathes/flows */
    float t = uTime * 0.05;
    p += 0.06 * (0.5 + deep) * vec2(fbm(p*3.0 + t), fbm(p*3.0 - t + 4.0));
    vec2 k1 = lsdFold(rot2(p, uTime*0.02), 6.0);
    /* recursive second fold — denser self-similar lattice at Heavy */
    vec2 k2 = lsdFold(rot2(k1*1.3, -uTime*0.013 + 0.7), 8.0 + 4.0*deep) / asp + ctr;
    k1 = k1 / asp + ctr;
    vec3 fold = (texture(uScene, clamp(k1, 0.0, 1.0)).rgb
               + texture(uScene, clamp(k2, 0.0, 1.0)).rgb) * 0.5;
    /* the folded copy reads as vivid geometry, not a dim echo */
    fold = mix(vec3(luma(fold)), fold, 1.25);
    /* hue varies across the folded field so the lattice reads rainbow/multi-hued
       rather than settling to one colour — the LSD register, not a monochrome
       radial tunnel */
    fold = hueRot(fold, (0.10 + 0.34*fbm(k1*2.3)) * (0.4 + deep));
    float texE = smoothstep(0.015, 0.10, abs(lumAt(uv, 2.0) - lumAt(uv, 5.0)));
    texE = mix(texE, 1.0, 0.35 * deep);               /* gate relaxes some, but keeps smooth/dark regions from forming a central void */
    col = mix(col, fold, heavy * texE * mix(0.90, 0.96, deep));
  }
  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){
  float w = uSig_rainbowTrail * smoothstep(0.18, 0.6, uIntensity);
  if (w > 0.004) {
    /* +12°/frame spectral advance on the feedback history; at Heavy the trail
       persists longer and shifts further, leaving long spectral smears */
    float deep = smoothstep(0.7, 1.0, uIntensity);
    vec3 prev = texture(uPrev, uv).rgb;
    prev = hueRot(prev, (0.21 + 0.15*deep) * uSig_rainbowTrail);
    col = mix(col, max(col, prev * (0.972 + 0.02*deep)), (0.45 + 0.30*deep) * w);
  }
  return col;
}
