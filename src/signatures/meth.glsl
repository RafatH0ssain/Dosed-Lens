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
    uv += churn * (2.4 / uRes) * flatness * w;
  }
  return uv;
}

vec3 sigColor(vec3 col, vec2 uv){
  float w = uSig_harshContrast * smoothstep(0.20, 0.9, uIntensity);

  /* vigilant hyper-detail: strong unsharp edge halo from the luminance pyramid
     (mip0 − mip3) — everything looks TOO sharp, edges bristle and separate.
     This is the core "wired, over-focused" meth read, not just darkening. */
  float hd = lumAt(uv, 0.0) - lumAt(uv, 3.0);
  col += clamp(vec3(hd), -0.45, 0.45) * w * 1.05;

  /* harsh local contrast, and a slight LIFT (over-bright vigilance) rather than
     the previous darkening that made it read as dim/bland */
  col = vec3(0.5) + (col - vec3(0.5)) * (1.0 + w * 0.6);
  col += w * 0.03;

  /* fine edge shimmer: high-edge regions crawl/vibrate faintly at ~18 Hz — the
     tweaked, restless quality; kept subtle so it doesn't just read as snow */
  float e = smoothstep(0.05, 0.25, edgeAt(uv).z);
  float shim = hash12(floor(gl_FragCoord.xy / 2.0) + floor(uTime * 18.0) * 3.1) - 0.5;
  col += shim * e * w * 0.14;

  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
