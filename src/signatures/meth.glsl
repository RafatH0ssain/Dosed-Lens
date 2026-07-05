/* Meth (high-dose / sleep-deprived) — "too sharp, snowing, movement in
   the corners"
   sigWarp:  texture crawl — granular 1–2 px churn ONLY where edge
             magnitude is low (flat walls crawl, objects hold still)
   sigColor: harsh local contrast on top of the shared unsharp/desat/snow;
             plus two effects added per PsychonautWiki research (meth's own
             page explicitly does NOT document visual snow/tracers/
             geometry as intrinsic effects — those stay purely from the
             general VSS statistics used for `snow` — but it DOES document
             "vibrating vision": eyeballs "spontaneously wiggle back and
             forth in rapid motion" at high doses, and rare
             "Transformations" (misreading one object as another) during
             extended wakefulness/high doses. Both give Strong/Heavy a more
             restless, chaotic feel without inventing psychedelic geometry
             that wouldn't be accurate to the substance.
   Peripheral shadow events + Heavy silhouettes come from the particle
   layer (shadowEvents / silhouette params), which flee the mouse.
   Also added (user feedback: Strong/Heavy needed more distortion, NOT
   color/rainbow): a nervous, fast pattern-breathe on the image's own
   edges/textures at Strong+ — PW documents "visual drifting... usually
   subtle... delirious in nature" at elevated doses; kept fast/jittery
   rather than a slow psychedelic swell so it reads as restless vigilance,
   not a trip.
   Params: crawl, shadowEvents, silhouette, harshContrast, vibrate,
   transform, breathe
   sources: psychonautwiki:methamphetamine */

/* rare "Transformations" gate — a brief, sparse window (~p=0.02/s, meant
   to be used already scaled to Heavy-only outside) where a high-edge
   region gets a brief spatial mis-sample, like an object looked wrong for
   an instant */
float methTransformGate(){
  float slot = floor(uTime);
  float has = step(1.0 - 0.022, hash1(slot * 5.19));
  float tIn = fract(uTime);
  return has * smoothstep(0.0, 0.05, tIn) * (1.0 - smoothstep(0.18, 0.30, tIn));
}

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

  /* nervous pattern-breathe: fast, jittery structural pulse ON the edges/
     textures themselves (opposite mask from crawl — this rides patterns,
     crawl rides flat walls), Strong+ only */
  float bw = uSig_breathe * smoothstep(0.5, 1.0, uIntensity);
  if (bw > 0.004) {
    vec2 tang = edgeTangent(uv);
    float mag = edgeAt(uv).z;
    float n = noise(uv * 3.2 + uTime * 0.65) - 0.5;
    uv += tang * mag * n * bw * 0.011;
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

  /* vibrating vision: "eyeballs spontaneously wiggle back and forth in
     rapid motion" at high doses — a fast, constant (not bursty) small
     double-image blur, distinct from MDMA's episodic nystagmus bursts */
  float vib = uSig_vibrate * smoothstep(0.55, 1.0, uIntensity);
  if (vib > 0.004) {
    float d = sin(uTime * TAU * 13.0) * 0.0026 * vib;
    vec3 v2 = texture(uScene, uv + vec2(d, 0.0)).rgb;
    col = mix(col, (col + v2) * 0.5, vib * 0.7);
  }

  /* rare Transformations — Heavy only, sparse, a high-edge region briefly
     mis-samples a nearby patch of itself: the uncanny "that looked like
     something else for a second" read, not a screen-space glitch */
  float tf = methTransformGate() * uSig_transform * smoothstep(0.85, 1.0, uIntensity);
  if (tf > 0.004) {
    float em = smoothstep(0.10, 0.30, edgeAt(uv).z);
    if (em > 0.01) {
      vec2 shift = (hash2(floor(uv * 5.0)) - 0.5) * 0.09;
      vec3 alt = texture(uScene, clamp(uv + shift, 0.0, 1.0)).rgb;
      col = mix(col, alt, tf * 0.55 * em);
    }
  }

  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
