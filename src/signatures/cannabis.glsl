/* Cannabis — "subtle: warmer, laggier, halos, time hiccups" (realism floor)
   sigTemporal: time hiccup (frame hold 120–250 ms every 4–9 s), mild tracers
   sigColor: warm lift, halo bloom on lights, red-shift, contrast drop
   sigWarp: peripheral-only micro-breathing. Full module in M5. */

vec2 sigWarp(vec2 uv){ return uv; }
vec3 sigColor(vec3 col, vec2 uv){ return col; }
vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
