/* Meth (high-dose/sleep-deprived) — "too sharp, snowing, movement in corners"
   sigColor: aggressive unsharp + contrast, cold desat, dense snow
   sigWarp: granular crawl in low-edge (flat) regions only
   sigTemporal: peripheral shadow events (mouse-avoidant), Heavy: rare
   humanoid silhouettes. Particle layer shared with DPH. Full module in M5. */

vec2 sigWarp(vec2 uv){ return uv; }
vec3 sigColor(vec3 col, vec2 uv){ return col; }
vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
