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
   painting seems built from, slowly turning — "large in size, soft in
   edges, smooth in motion," never a sharp fractal cut */
vec3 kCubism(vec2 uv, float voff, float w){
  vec2 asp = vec2(uAspect, 1.0);
  vec2 p = uv * asp * 2.2;
  p = rot2(p, uTime * 0.012);
  vec2 cell = floor(p);
  vec2 f = fract(p);
  float h = hash1(dot(cell, vec2(12.9898, 78.233)) + 4.0);
  vec2 facetOff = (hash2(cell + 5.1) - 0.5) * 0.026 * w;
  float facetZoom = 1.0 + (h - 0.5) * 0.07 * w;
  vec2 fuv = clamp((uv - 0.5) * facetZoom + 0.5 + facetOff, 0.0, 1.0);
  vec3 fcol = 0.5 * (texture(uScene, fuv).rgb
                    + texture(uScene, clamp(fuv + vec2(0.0, voff), 0.0, 1.0)).rgb);
  /* multicoloured, glossy: a gentle per-facet hue turn + soft sheen */
  fcol = hueRot(fcol, (h - 0.5) * 0.4 * w);
  float distToEdge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
  float seam = 1.0 - smoothstep(0.0, 0.11, distToEdge);
  fcol *= 1.0 - seam * 0.20 * w;
  fcol += seam * w * 0.06 * vec3(0.55, 0.68, 0.85);
  return fcol;
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
