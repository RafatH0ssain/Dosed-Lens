/* Alcohol — "double vision, lag, and eventually the spins"
   sigWarp: horizontal diplopia w/ convergence hunting (±20% @ 0.3 Hz),
            horizon sway ±1.5° @ 0.15 Hz; Heavy: the spins (0.5 rpm roll)
   sigTemporal: pan-lag smear (uPrev 0.25 mix)
   sigColor: warm flush + mild vignette. Full module in M3. */

vec2 sigWarp(vec2 uv){ return uv; }
vec3 sigColor(vec3 col, vec2 uv){ return col; }
vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
