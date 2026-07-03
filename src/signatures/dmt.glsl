/* DMT — "instant, fast, crystalline, then somewhere else entirely"
   onset envelope (CPU): overshoot ×1.3 over 2 s on tier-up
   sigWarp: 8–13 Hz edge micro-shimmer
   sigColor: neon 6-color hue quantization + chrysanthemum mandala
   Heavy: full tunnel + entity crossfade seeded by uSeedCol. Full module in M4. */

vec2 sigWarp(vec2 uv){ return uv; }
vec3 sigColor(vec3 col, vec2 uv){ return col; }
vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
