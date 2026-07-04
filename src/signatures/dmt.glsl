/* DMT — "instant, fast, crystalline, then somewhere else entirely"
   CPU side: onsetRush param triggers the ×1.3 intensity overshoot on
   upward moves; mandala/breakthrough/entities are driven into P3 via the
   pattern-drive uniforms (main.ts), palette seeded from uSeedCol.
   sigWarp:  8–13 Hz micro-shimmer riding the edge normals
   sigColor: hue quantization to a neon 6-step wheel (luma preserved,
             chroma boosted) — the crystalline look
   Params: shimmer, neonQuant, mandala, breakthrough, onsetRush */

vec2 sigWarp(vec2 uv){
  float w = uSig_shimmer * smoothstep(0.02, 0.35, uIntensity);
  if (w > 0.004) {
    vec4 e = edgeAt(uv);
    vec2 dir = e.xy * 2.0 - 1.0;
    /* two incommensurate fast frequencies ≈ 8–13 Hz band */
    float osc = sin(uTime * TAU * 9.0 + uv.y * 40.0) * 0.6
              + sin(uTime * TAU * 12.7 + uv.x * 55.0) * 0.4;
    uv += dir * e.z * osc * w * 0.0018;
  }
  return uv;
}

vec3 sigColor(vec3 col, vec2 uv){
  float w = uSig_neonQuant * smoothstep(0.22, 0.75, uIntensity);
  if (w > 0.004) {
    /* quantize hue in a cheap opponent plane, keep luminance */
    float y = luma(col);
    float cr = col.r - y, cb = col.b - y;
    float hue = atan(cb, cr);
    float mag = length(vec2(cr, cb));
    float qh = (floor(hue / (TAU / 6.0) + 0.5)) * (TAU / 6.0);
    float qmag = mag * 1.7 + 0.03 * step(0.02, mag);
    float nr = cos(qh) * qmag, nb = sin(qh) * qmag;
    vec3 neon;
    neon.r = y + nr;
    neon.b = y + nb;
    neon.g = (y - 0.2126 * neon.r - 0.0722 * neon.b) / 0.7152;
    col = mix(col, clamp(neon, 0.0, 1.6), w);
  }
  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
