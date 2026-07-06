/* Ketamine — "the world becomes a flat painting at the end of a tunnel"
   sigColor carries the identity (recession + doubling need two scene taps
   and a dark surround, which a pure uv warp cannot express):
     · world recession — scene shrinks toward the center in a dark surround
     · vertical-divergence double vision on the receded image
     · painting-flattening — blur low-edge regions, keep strong edges
     · environmental cubism — flat-shaded posterized panels (PsychonautWiki's
       "algorithmic/synthetic/low-complexity" ketamine geometry, distinct
       from psychedelic fractals)
     · dissolve — a continuous edge-tangent-advected, posterized field that
       the photo gives way to at Heavy (flat/desaturated, never rainbow)
   Shared params supply stutter, desat, cool cast, late tunnel vignette.
   Params: recession, flatten, kholeTunnel, verticalDouble, cubism, dissolve */

vec2 sigWarp(vec2 uv){ return uv; }

vec3 kFlat(vec2 uv){
  vec2 px = 5.0 / uRes;
  vec3 acc = texture(uScene, uv).rgb * 0.2;
  acc += texture(uScene, uv + vec2( px.x,  px.y)).rgb * 0.2;
  acc += texture(uScene, uv + vec2(-px.x,  px.y)).rgb * 0.2;
  acc += texture(uScene, uv + vec2( px.x, -px.y)).rgb * 0.2;
  acc += texture(uScene, uv + vec2(-px.x, -px.y)).rgb * 0.2;
  return acc;
}

/* wide 9-tap average — a stable flat "panel" colour; a sparse 4-tap blur
   aliases against fine texture as the sample UV drifts (reads as vibration) */
vec3 kFlatWide(vec2 uv, float r){
  vec2 px = r / uRes;
  vec3 acc = texture(uScene, uv).rgb * 0.2;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7853982;
    acc += texture(uScene, uv + vec2(cos(a), sin(a)) * px).rgb * 0.1;
  }
  return acc;
}

/* dissolve: one continuous field advected along the image's own edge
   tangents (so it belongs to the photo, not a cloud drifting over it),
   posterized flat and tinted from the seed palette. */
vec3 kDissolve(vec2 uv, vec3 baseCol, float w){
  vec2 tang = edgeTangent(uv);
  float mag = edgeAt(uv).z;
  float crawl = 0.5 + 0.5 * sin(uTime * 0.16 + fbm(uv * 1.7) * 4.0);
  vec2 flow = uv + tang * (0.35 + 0.65 * mag) * (0.05 + 0.06 * crawl) * w;

  float n1 = fbm(flow * 2.2 + uTime * 0.07);
  float n2 = fbm(flow * 4.1 - uTime * 0.05 + 5.0);
  float sigRaw = n1 * 0.6 + n2 * 0.4;
  float post = floor(sigRaw * 3.0 + 0.5) / 3.0;
  float sig = mix(sigRaw, post, 0.8);
  /* thin ink-like contour where the posterize bands change */
  float bandEdge = pow(1.0 - abs(sin(sigRaw * 9.0 + uTime * 0.15)), 8.0);

  /* image-structure mask, but with a high floor: even smooth walls and
     bright glow must dissolve here (the photo itself is giving way) */
  float l = lumAt(uv, 0.0);
  float midband = abs(lumAt(uv, 2.0) - lumAt(uv, 5.0));
  float texEnergy = smoothstep(0.01, 0.10, midband);
  float lumMask = mix(0.6, 1.0, smoothstep(0.02, 0.18, l))
                * mix(0.6, 1.0, 1.0 - smoothstep(0.82, 0.99, l));
  float mask = mix(0.7, 1.0, texEnergy) * lumMask;

  vec3 seedA = mix(uSeedCol[0].rgb, uSeedCol[2].rgb, 0.5 + 0.5 * sin(uTime * 0.05));
  vec3 seedB = mix(uSeedCol[1].rgb, uSeedCol[3].rgb, 0.5 + 0.5 * cos(uTime * 0.045));
  vec3 palette = mix(seedA, seedB, sig);
  /* light tie to the underlying pixel's hue so it still belongs to this photo */
  vec3 chroma = baseCol / max(luma(baseCol), 0.05);
  palette = mix(palette, palette * chroma, 0.28);

  /* pulse stays strictly positive — a negative dip clamps the whole
     near-full-frame mask to black for part of every cycle */
  float pulse = 0.62 + 0.38 * sin(uTime * 0.12 + sig * 3.0);
  vec3 dissolved = palette * pulse;
  dissolved *= 1.0 - bandEdge * 0.5;

  return mix(baseCol, dissolved, clamp(mask * 1.6, 0.0, 1.0) * w);
}

/* environmental cubism: large flat-shaded panels via a 2-nearest-seed
   partition with a wide soft cross-fade (no hard Voronoi seam). */
vec3 kCubism(vec2 uv, float voff, float w){
  vec2 asp = vec2(uAspect, 1.0);
  vec2 p = uv * asp;
  const int N = 11;
  float d0 = 1e9, d1 = 1e9;
  float i0 = 0.0, i1 = 0.0;
  vec2 seed0 = vec2(0.0), seed1 = vec2(0.0);
  for (int i = 0; i < N; i++) {
    float fi = float(i);
    vec2 seed = vec2(hash1(fi * 3.7 + 1.0), hash1(fi * 5.3 + 7.0)) * asp;
    float dist = length(p - seed);
    if (dist < d0) { d1 = d0; i1 = i0; seed1 = seed0; d0 = dist; i0 = fi; seed0 = seed; }
    else if (dist < d1) { d1 = dist; i1 = fi; seed1 = seed; }
  }

  float ph0 = hash1(i0 * 9.1 + 2.0) * TAU;
  float ph1 = hash1(i1 * 9.1 + 2.0) * TAU;
  float br0 = 0.5 + 0.5 * sin(uTime * 0.12 + ph0);
  float br1 = 0.5 + 0.5 * sin(uTime * 0.12 + ph1);
  vec2 off0 = (hash2(vec2(i0, 1.0)) - 0.5) * (0.012 + 0.012 * br0) * w;
  vec2 off1 = (hash2(vec2(i1, 1.0)) - 0.5) * (0.012 + 0.012 * br1) * w;
  float z0 = 1.0 + ((hash1(i0 * 2.0) - 0.5) * 0.05 + (br0 - 0.5) * 0.025) * w;
  float z1 = 1.0 + ((hash1(i1 * 2.0) - 0.5) * 0.05 + (br1 - 0.5) * 0.025) * w;

  vec2 fuv0 = clamp((uv - 0.5) * z0 + 0.5 + off0, 0.0, 1.0);
  vec2 fuv1 = clamp((uv - 0.5) * z1 + 0.5 + off1, 0.0, 1.0);

  vec3 photo0 = 0.5 * (texture(uScene, fuv0).rgb
                      + texture(uScene, clamp(fuv0 + vec2(0.0, voff), 0.0, 1.0)).rgb);
  vec3 photo1 = 0.5 * (texture(uScene, fuv1).rgb
                      + texture(uScene, clamp(fuv1 + vec2(0.0, voff), 0.0, 1.0)).rgb);
  vec3 flat0 = kFlatWide(fuv0, 26.0);
  vec3 flat1 = kFlatWide(fuv1, 26.0);

  /* mostly the wide flat average (the synthetic read), fading to fully flat
     by Heavy so the dissolve has nothing photographic left to fight */
  vec3 c0 = mix(photo0, flat0, 0.45 + 0.55 * w);
  vec3 c1 = mix(photo1, flat1, 0.45 + 0.55 * w);

  vec3 post0 = floor(c0 * 3.2 + 0.5) / 3.2;
  vec3 post1 = floor(c1 * 3.2 + 0.5) / 3.2;
  c0 = mix(c0, post0, 0.35 + 0.60 * w);
  c1 = mix(c1, post1, 0.35 + 0.60 * w);

  /* small bounded radial highlight per facet (flat polygon lit from centre) */
  float gloss0 = 1.0 - smoothstep(0.0, 1.3, length(p - seed0));
  float gloss1 = 1.0 - smoothstep(0.0, 1.3, length(p - seed1));
  c0 += gloss0 * 0.06 * w;
  c1 += gloss1 * 0.06 * w;

  c0 = hueRot(c0, ((hash1(i0 * 2.0) - 0.5) * 0.30 + (br0 - 0.5) * 0.15) * w);
  c1 = hueRot(c1, ((hash1(i1 * 2.0) - 0.5) * 0.30 + (br1 - 0.5) * 0.15) * w);

  float weight0 = smoothstep(-0.35, 0.35, d1 - d0);
  return mix(c1, c0, weight0);
}

vec3 sigColor(vec3 col, vec2 uv){
  float inten = uIntensity;

  /* world recession: shrink the scene into a dark surround. Two-part curve
     so the k-hole is sudden — a small margin through Strong, the rest spiking
     in the last ~15% of the slider. */
  float recBase = uSig_recession * smoothstep(0.45, 0.85, inten) * 0.15;
  float recSpike = uSig_recession * smoothstep(0.85, 1.0, inten) * 0.43;
  float rec = recBase + recSpike;
  vec2 ruv = (uv - 0.5) / max(1.0 - rec, 1e-3) + 0.5;
  /* boundary: a true circle (x scaled by aspect) whose radius breathes on
     three angular harmonics, with a very wide feather so there's no crisp
     edge between painting and dark */
  vec2 rc = (ruv - 0.5) * vec2(uAspect, 1.0) * 2.0;
  float rAng = atan(rc.y, rc.x);
  float rLen = length(rc);
  float breatheR = 1.0
    + 0.09 * sin(uTime * 0.17 + rAng * 3.0)
    + 0.06 * sin(uTime * 0.11 - rAng * 5.0 + 1.7)
    + 0.035 * sin(uTime * 0.26 + rAng * 2.0 + 4.1);
  float edgeR = rLen / max(breatheR, 1e-3);
  /* gate the crop by recession's own onset — otherwise a circle inscribed in
     a rectangle blacks out the four corners even at Threshold */
  float boundaryW = smoothstep(0.42, 0.80, inten);
  float inside = mix(1.0, smoothstep(1.20, 0.45, edgeR), boundaryW);
  vec2 suv = clamp(ruv, 0.0, 1.0);

  /* dissolve pre-warp: a real 2D domain-warp so silhouettes (lamp glow, wall
     outline) move too, not just recolour. Onsets in Common, full by Heavy. */
  float dissW0 = uSig_dissolve * smoothstep(0.32, 0.85, inten);
  if (dissW0 > 0.004) {
    float t = uTime * 0.075;
    vec2 n = vec2(fbm(suv * 2.1 + t), fbm(suv * 2.1 - t + 9.0));
    float pulse = 0.55 + 0.45 * sin(uTime * 0.13);
    suv = clamp(suv + (n - 0.5) * 0.11 * dissW0 * pulse, 0.0, 1.0);
  }

  /* vertical-divergence double vision (the only diplopia ketamine uses),
     amplitude pulsing so the ghost breathes rather than sitting static */
  float voff = uSig_verticalDouble * (0.005 + 0.032 * smoothstep(0.32, 0.92, inten))
             * (0.72 + 0.28 * sin(uTime * 0.16));
  vec3 scn = 0.5 * (texture(uScene, suv).rgb
                  + texture(uScene, clamp(suv + vec2(0.0, voff), 0.0, 1.0)).rgb);

  /* painting flattening: smooth weak-edge regions; strong edges lose some of
     their protection at higher doses so the whole painting participates */
  float flatW = uSig_flatten * smoothstep(0.45, 0.90, inten);
  if (flatW > 0.004) {
    float em = edgeAt(suv).z;
    float edgeProtect = 1.0 - em * (1.0 - 0.55 * smoothstep(0.5, 1.0, inten));
    vec3 flat5 = 0.5 * (kFlat(suv) + kFlat(clamp(suv + vec2(0.0, voff), 0.0, 1.0)));
    scn = mix(scn, flat5, flatW * edgeProtect * 0.85);
    scn = mix(scn, vec3(0.5) + (scn - vec3(0.5)) * 0.62, flatW * 0.65);
  }

  /* environmental cubism — carries Strong so it doesn't rely on the black */
  float cubW = uSig_cubism * smoothstep(0.40, 0.80, inten);
  if (cubW > 0.004) {
    vec3 cub = kCubism(suv, voff, cubW);
    scn = mix(scn, cub, cubW);
  }

  /* dissolve colour: first colourful touch in Common, full replacement by
     Heavy (Common/Strong colourful, k-hole reserved for Heavy) */
  float dissolveW = uSig_dissolve * smoothstep(0.36, 0.88, inten);
  if (dissolveW > 0.004) {
    scn = mix(scn, kDissolve(suv, scn, dissolveW), dissolveW);
  }

  /* dark cold surround; k-hole deepens it toward black on the same sudden
     two-part shape as recession */
  float holeBase = uSig_kholeTunnel * smoothstep(0.45, 0.85, inten) * 0.30;
  float holeSpike = uSig_kholeTunnel * smoothstep(0.85, 1.0, inten) * 0.65;
  float hole = holeBase + holeSpike;
  vec3 surround = vec3(0.030, 0.034, 0.048) * (1.0 - hole * 0.95);
  return mix(surround, scn, inside);
}

vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
