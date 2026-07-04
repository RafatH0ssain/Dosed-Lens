/* Meth (high-dose / sleep-deprived) — "too sharp, snowing, movement in
   the corners"
   sigWarp:  texture crawl — granular 1–2 px churn ONLY where edge
             magnitude is low (flat walls crawl, objects hold still)
   sigColor: harsh local contrast on top of the shared unsharp/desat/snow
   Peripheral shadow events + Heavy silhouettes come from the particle
   layer (shadowEvents / silhouette params), which flee the mouse.
   Params: crawl, shadowEvents, silhouette, harshContrast */

vec2 sigWarp(vec2 uv){
  float w = uSig_crawl * smoothstep(0.3, 0.85, uIntensity);
  if (w > 0.004) {
    /* gate to FLAT regions only — flat walls churn, edges/objects hold still */
    float flatness = 1.0 - smoothstep(0.04, 0.22, edgeAt(uv).z);
    /* granular cells, but the churn drifts slowly and smoothly rather than
       jittering every frame: reseed at ~2.5 Hz and ease between reseeds so the
       surface crawls like a slow living texture, not TV noise */
    vec2 cell = floor(uv * uRes / 3.0);
    float ts = uTime * 2.5;
    float f = fract(ts);
    vec2 c0 = hash2(cell + floor(ts) * 0.37);
    vec2 c1 = hash2(cell + (floor(ts) + 1.0) * 0.37);
    vec2 churn = mix(c0, c1, f * f * (3.0 - 2.0 * f));
    uv += churn * (1.7 / uRes) * flatness * w;
  }
  return uv;
}

vec3 sigColor(vec3 col, vec2 uv){
  float w = uSig_harshContrast * smoothstep(0.25, 0.9, uIntensity);
  /* vigilant harshness: local contrast up, blacks crushed slightly */
  col = vec3(0.5) + (col - vec3(0.5)) * (1.0 + w * 0.45);
  col -= w * 0.02;
  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
