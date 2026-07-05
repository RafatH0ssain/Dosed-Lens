/* Ketamine — "the world becomes a flat painting at the end of a tunnel"
   sigColor carries the identity (recession + doubling need two scene taps
   and a dark surround, which a pure uv warp cannot express):
     · world recession — scene shrinks toward the center inside a dark
       surround (→ ~70% at Heavy)
     · vertical-divergence double vision on the receded image
     · painting-flattening — blur where edge magnitude is low, keep strong
       edges; local contrast crush
     · environmental cubism / scenery slicing — PsychonautWiki documents
       real high-dose ketamine geometry distinct from psychedelics'
       fractal/kaleidoscope symmetry: "environmental cubism," "environmental
       orbism," "scenery slicing," characterized as "simplistic in
       complexity, algorithmic... synthetic... dimly lit... multicoloured...
       glossy... soft in edges... large in size... smooth in motion" (and
       explicitly milder/less intricate than psychedelic geometry). After
       three rounds of user feedback ("not psychedelic at all," an obvious
       "V" artifact, edges too plain), rebuilt around the "algorithmic...
       synthetic" wording specifically: each facet is now a heavily-
       averaged, mildly-posterized FLAT-SHADED panel with a soft local
       radial highlight — the world looks re-rendered as a low-poly/
       synthetic mesh of itself, not a subtly-shifted photograph. This is
       deliberately a different kind of "reality changing" than
       LSD/DMT — flat, geometric, dim, low-complexity, never fractal or
       rainbow-saturated.
   Shared params supply stutter, desat, cool cast, late tunnel vignette.
   Heavy-only "dissolve": user feedback asked for the image to visibly
   disappear into pattern/shimmer/breathing at Heavy, not just facet — see
   kShimmer below.
   Params: recession, flatten, kholeTunnel, verticalDouble, cubism, dissolve
   sources: psychonautwiki:ketamine */

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

/* a much wider average than kFlat — approximates the flat, averaged
   colour of a whole "panel" rather than a light photographic soften.
   9 taps (centre + 8-direction ring) rather than 4 corners: a sparse
   4-tap "blur" aliases against fine texture (brick) as the sample UV
   drifts even slowly, which is what read as "jittery/vibrating" — more
   taps make this a true stable average instead. */
vec3 kFlatWide(vec2 uv, float r){
  vec2 px = r / uRes;
  vec3 acc = texture(uScene, uv).rgb * 0.2;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7853982;
    acc += texture(uScene, uv + vec2(cos(a), sin(a)) * px).rgb * 0.1;
  }
  return acc;
}

/* environmental cubism / scenery slicing: large flat-shaded panels the
   painting seems re-rendered from. Third rewrite after user feedback:
   v1 rotated a rectangular sample grid every frame — pixels near cell
   borders flipped between facets each frame (jitter/flicker), and the
   axis-aligned grid moiréd against any regularly-patterned image (brick
   courses) into a literal "fence/plaid" look. v2 scattered irregular seed
   points with a soft cross-fade (fixed the jitter/moiré) but read as a
   photo with a slight shift, not real distortion, and its "glossy sheen"
   was an unbounded diagonal plane wave across the WHOLE frame — two such
   waves at different phases crossing each other is exactly what produced
   the reported "V" artifact. v3 (this one) keeps the irregular-seed
   scatter but drops the plane-wave sheen entirely in favour of a small,
   spatially-bounded radial highlight per facet, and leans hard into
   "algorithmic... synthetic... simplistic in complexity" by making each
   facet mostly a wide flat average of itself (kFlatWide) rather than a
   sharp resample, lightly posterized. */
/* Heavy dissolve — user feedback: "make the image disappear in patterns
   and shimmers and breathing at heavy." Above ~0.8 intensity, each
   facet's remaining photographic content is progressively replaced by a
   shimmering, slowly breathing synthetic colour field built from the
   facet's own flat-shaded colour and the photo's overall dominant
   palette (uSeedCol) — the picture is genuinely gone at full Heavy, not
   just faceted, but it stays in ketamine's own soft-blob/flat-shaded
   language rather than borrowing DMT's tunnel or LSD's fractal. */
vec3 kShimmer(vec2 p, float ph, vec3 baseCol){
  float n1 = fbm(p * 1.4 + ph * 3.0 + uTime * 0.09);
  float n2 = fbm(p * 2.6 - ph * 2.0 - uTime * 0.06);
  float shimmer = 0.5 + 0.5 * sin((n1 + n2) * 7.0 + uTime * 0.7 + ph * 4.0);
  vec3 seedA = mix(uSeedCol[0].rgb, uSeedCol[1].rgb, 0.5 + 0.5 * sin(ph));
  vec3 seedB = mix(uSeedCol[2].rgb, uSeedCol[3].rgb, 0.5 + 0.5 * cos(ph));
  vec3 palette = mix(seedA, seedB, shimmer);
  vec3 col = mix(baseCol, palette, 0.7);
  float breathe = 0.55 + 0.45 * sin(uTime * 0.15 + ph * 1.6);
  return col * breathe;
}

vec3 kCubism(vec2 uv, float voff, float w){
  vec2 asp = vec2(uAspect, 1.0);
  vec2 p = uv * asp;
  const int N = 6;
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

  /* breathing slowed further and its contribution to zoom/offset cut —
     the continuous sub-pixel drift it caused in the facet sample was
     part of what read as "jittery/vibrating" (the wider kFlatWide above
     addresses the rest) */
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

  /* mostly the wide flat average — the "synthetic/low-complexity" read —
     with a little of the photo underneath at low-mid tiers, fading to
     (almost) none by Heavy so the dissolve below has nothing photographic
     left to fight */
  vec3 c0 = mix(photo0, flat0, 0.55 + 0.42 * w);
  vec3 c1 = mix(photo1, flat1, 0.55 + 0.42 * w);

  /* light posterize — "algorithmic... simplistic in complexity" — blended
     in rather than a full replace, so it reads as quantized shading, not
     harsh banding */
  vec3 post0 = floor(c0 * 4.5 + 0.5) / 4.5;
  vec3 post1 = floor(c1 * 4.5 + 0.5) / 4.5;
  c0 = mix(c0, post0, 0.5 * w);
  c1 = mix(c1, post1, 0.5 * w);

  /* small, bounded radial highlight from the facet's own seed — reads as
     a flat polygon lit from its centre, unlike the old plane-wave sheen
     (unbounded, spans the whole frame, and is what caused the "V") */
  float gloss0 = 1.0 - smoothstep(0.0, 1.3, length(p - seed0));
  float gloss1 = 1.0 - smoothstep(0.0, 1.3, length(p - seed1));
  c0 += gloss0 * 0.06 * w;
  c1 += gloss1 * 0.06 * w;

  c0 = hueRot(c0, ((hash1(i0 * 2.0) - 0.5) * 0.30 + (br0 - 0.5) * 0.15) * w);
  c1 = hueRot(c1, ((hash1(i1 * 2.0) - 0.5) * 0.30 + (br1 - 0.5) * 0.15) * w);

  /* Heavy dissolve: the image disappears into shimmer/breathing */
  float dissolveW = uSig_dissolve * smoothstep(0.80, 1.0, uIntensity);
  if (dissolveW > 0.004) {
    c0 = mix(c0, kShimmer(p, ph0, c0), dissolveW);
    c1 = mix(c1, kShimmer(p, ph1, c1), dissolveW);
  }

  /* wide, soft cross-fade between only the two closest facets — no hard
     seam anywhere in the frame */
  float weight0 = smoothstep(-0.35, 0.35, d1 - d0);
  return mix(c1, c0, weight0);
}

vec3 sigColor(vec3 col, vec2 uv){
  float inten = uIntensity;

  /* ---- world recession: sample a shrunk scene, dark around it ---- */
  float rec = uSig_recession * smoothstep(0.30, 1.0, inten) * 0.58;
  vec2 ruv = (uv - 0.5) / max(1.0 - rec, 1e-3) + 0.5;
  /* rounded mask — user feedback: the receding painting's hard rectangular
     corners should be rounded off. A superellipse (squircle) softens the
     corners into a curve while staying mostly rectangular in the middle
     of each edge, rather than a full oval/porthole. */
  vec2 rc = (ruv - 0.5) * 2.0;
  float superell = pow(abs(rc.x), 4.0) + pow(abs(rc.y), 4.0);
  float inside = smoothstep(1.06, 0.90, superell);
  vec2 suv = clamp(ruv, 0.0, 1.0);

  /* ---- vertical-divergence double vision (reduced a bit per feedback) ---- */
  float voff = uSig_verticalDouble * (0.005 + 0.032 * smoothstep(0.12, 0.85, inten));
  vec3 scn = 0.5 * (texture(uScene, suv).rgb
                  + texture(uScene, clamp(suv + vec2(0.0, voff), 0.0, 1.0)).rgb);

  /* ---- painting flattening: smooth the weak-edge regions ---- */
  float flatW = uSig_flatten * smoothstep(0.10, 0.70, inten);
  if (flatW > 0.004) {
    float em = edgeAt(suv).z;
    /* hard edges (mortar lines, object outlines) used to stay fully crisp
       forever — user feedback: they "still exist plainly" against
       everything else swimming. At higher doses they now lose some of
       that protection too, so the whole painting participates. */
    float edgeProtect = 1.0 - em * (1.0 - 0.55 * smoothstep(0.5, 1.0, inten));
    vec3 flat5 = 0.5 * (kFlat(suv) + kFlat(clamp(suv + vec2(0.0, voff), 0.0, 1.0)));
    scn = mix(scn, flat5, flatW * edgeProtect * 0.85);
    /* local contrast crush — the "painting" look */
    scn = mix(scn, vec3(0.5) + (scn - vec3(0.5)) * 0.62, flatW * 0.65);
  }

  /* ---- environmental cubism / scenery slicing: wakes up by upper-Common
     now (was Strong-only — user feedback: "no psychedelic effects after
     high common doses") ---- */
  float cubW = uSig_cubism * smoothstep(0.35, 0.85, inten);
  if (cubW > 0.004) {
    vec3 cub = kCubism(suv, voff, cubW);
    /* extra push at Heavy so the dissolved/shimmering result isn't
       diluted back with the un-dissolved photo underneath — the point is
       for the image to actually disappear, not just mostly */
    float finalBlend = min(cubW * 0.85 + smoothstep(0.8, 1.0, inten) * 0.15, 0.98);
    scn = mix(scn, cub, finalBlend);
  }

  /* ---- dark cold surround; k-hole deepens it toward black ---- */
  float hole = uSig_kholeTunnel * smoothstep(0.68, 1.0, inten);
  vec3 surround = vec3(0.030, 0.034, 0.048) * (1.0 - hole * 0.95);
  return mix(surround, scn, inside);
}

vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
