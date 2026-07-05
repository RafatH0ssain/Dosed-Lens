/* Ketamine — "the world becomes a flat painting at the end of a tunnel"
   sigColor carries the identity (recession + doubling need two scene taps
   and a dark surround, which a pure uv warp cannot express):
     · world recession — scene shrinks toward the center inside a dark
       surround (→ ~70% at Heavy)
     · vertical-divergence double vision on the receded image
     · painting-flattening — blur where edge magnitude is low, keep strong
       edges; local contrast crush
     · environmental cubism / scenery slicing — user feedback: Heavy read
       as "just smaller and shaky." PsychonautWiki documents real
       high-dose ketamine geometry distinct from psychedelics'
       fractal/kaleidoscope symmetry: "environmental cubism," "environmental
       orbism," "scenery slicing," characterized as "simplistic in
       complexity, algorithmic... synthetic... dimly lit... multicoloured...
       glossy... soft in edges... large in size... smooth in motion" (and
       explicitly milder/less intricate than psychedelic geometry). Modeled
       as a handful of large, softly-bounded panels the painting seems
       assembled from, each independently re-sampled/tinted/glossy — the
       world looks sliced into slightly-disagreeing facets, not warped.
   Shared params supply stutter, desat, cool cast, late tunnel vignette.
   Params: recession, flatten, kholeTunnel, verticalDouble, cubism
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

/* environmental cubism / scenery slicing: large soft glossy facets the
   painting seems built from — "large in size, soft in edges, smooth in
   motion," never a sharp fractal cut. Rewritten twice after user feedback:
   v1 rotated a rectangular sample grid every frame — pixels near cell
   borders flipped between facets each frame (jitter/flicker), and the
   axis-aligned grid moiréd against any regularly-patterned image (brick
   courses) into a literal "fence/plaid" look, while barely reading at all
   on flatter scenes. v2 scatters a handful of seed points irregularly
   (no periodicity, so no moiré against regular textures) and blends
   smoothly between only the two nearest seeds over a wide feather — there
   is no hard cell boundary anywhere, and the grid never moves, so there
   is nothing to flicker. Each seed's zoom/offset/hue breathes over time
   via its own fixed sine phase (the "breathing/patterns" ask). */
vec3 kCubism(vec2 uv, float voff, float w){
  vec2 asp = vec2(uAspect, 1.0);
  vec2 p = uv * asp;
  const int N = 6;
  float d0 = 1e9, d1 = 1e9;
  float i0 = 0.0, i1 = 0.0;
  for (int i = 0; i < N; i++) {
    float fi = float(i);
    vec2 seed = vec2(hash1(fi * 3.7 + 1.0), hash1(fi * 5.3 + 7.0)) * asp;
    float dist = length(p - seed);
    if (dist < d0) { d1 = d0; i1 = i0; d0 = dist; i0 = fi; }
    else if (dist < d1) { d1 = dist; i1 = fi; }
  }

  float ph0 = hash1(i0 * 9.1 + 2.0) * TAU;
  float ph1 = hash1(i1 * 9.1 + 2.0) * TAU;
  float br0 = 0.5 + 0.5 * sin(uTime * 0.22 + ph0);
  float br1 = 0.5 + 0.5 * sin(uTime * 0.22 + ph1);
  vec2 off0 = (hash2(vec2(i0, 1.0)) - 0.5) * (0.008 + 0.014 * br0) * w;
  vec2 off1 = (hash2(vec2(i1, 1.0)) - 0.5) * (0.008 + 0.014 * br1) * w;
  float z0 = 1.0 + ((hash1(i0 * 2.0) - 0.5) * 0.032 + (br0 - 0.5) * 0.032) * w;
  float z1 = 1.0 + ((hash1(i1 * 2.0) - 0.5) * 0.032 + (br1 - 0.5) * 0.032) * w;

  vec2 fuv0 = clamp((uv - 0.5) * z0 + 0.5 + off0, 0.0, 1.0);
  vec2 fuv1 = clamp((uv - 0.5) * z1 + 0.5 + off1, 0.0, 1.0);
  /* blend toward a softened sample for the facet re-fetch: a sharp
     re-sample of a fine repeating texture (brick courses) at a slightly
     different zoom/offset per facet beats against itself and reads as a
     moiré "fence," not cubism — softening kills the interference while
     keeping the panel displacement visible */
  vec3 c0 = mix(0.5 * (texture(uScene, fuv0).rgb
                      + texture(uScene, clamp(fuv0 + vec2(0.0, voff), 0.0, 1.0)).rgb),
                kFlat(fuv0), 0.5);
  vec3 c1 = mix(0.5 * (texture(uScene, fuv1).rgb
                      + texture(uScene, clamp(fuv1 + vec2(0.0, voff), 0.0, 1.0)).rgb),
                kFlat(fuv1), 0.5);
  c0 = hueRot(c0, ((hash1(i0 * 2.0) - 0.5) * 0.30 + (br0 - 0.5) * 0.15) * w);
  c1 = hueRot(c1, ((hash1(i1 * 2.0) - 0.5) * 0.30 + (br1 - 0.5) * 0.15) * w);

  /* wide, soft cross-fade between only the two closest facets — no hard
     seam anywhere in the frame */
  float weight0 = smoothstep(-0.35, 0.35, d1 - d0);
  return mix(c1, c0, weight0);
}

vec3 sigColor(vec3 col, vec2 uv){
  float inten = uIntensity;

  /* ---- world recession: sample a shrunk scene, dark around it ---- */
  float rec = uSig_recession * smoothstep(0.30, 1.0, inten) * 0.42;
  vec2 ruv = (uv - 0.5) / max(1.0 - rec, 1e-3) + 0.5;
  /* soft box mask — inside the receding painting */
  vec2 bd = min(ruv, 1.0 - ruv);
  float inside = smoothstep(-0.015, 0.02, min(bd.x, bd.y));
  vec2 suv = clamp(ruv, 0.0, 1.0);

  /* ---- vertical-divergence double vision ---- */
  float voff = uSig_verticalDouble * (0.005 + 0.044 * smoothstep(0.12, 0.85, inten));
  vec3 scn = 0.5 * (texture(uScene, suv).rgb
                  + texture(uScene, clamp(suv + vec2(0.0, voff), 0.0, 1.0)).rgb);

  /* ---- painting flattening: smooth the weak-edge regions ---- */
  float flatW = uSig_flatten * smoothstep(0.10, 0.70, inten);
  if (flatW > 0.004) {
    float em = edgeAt(suv).z;
    vec3 flat5 = 0.5 * (kFlat(suv) + kFlat(clamp(suv + vec2(0.0, voff), 0.0, 1.0)));
    scn = mix(scn, flat5, flatW * (1.0 - em) * 0.85);
    /* local contrast crush — the "painting" look */
    scn = mix(scn, vec3(0.5) + (scn - vec3(0.5)) * 0.62, flatW * 0.65);
  }

  /* ---- environmental cubism / scenery slicing: Strong+ only, PW's own
     documented ketamine geometry, distinct from a psychedelic fractal ---- */
  float cubW = uSig_cubism * smoothstep(0.55, 1.0, inten);
  if (cubW > 0.004) {
    vec3 cub = kCubism(suv, voff, cubW);
    scn = mix(scn, cub, cubW * 0.65);
  }

  /* ---- dark cold surround; k-hole deepens it toward black ---- */
  float hole = uSig_kholeTunnel * smoothstep(0.68, 1.0, inten);
  vec3 surround = vec3(0.030, 0.034, 0.048) * (1.0 - hole * 0.95);
  return mix(surround, scn, inside);
}

vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
