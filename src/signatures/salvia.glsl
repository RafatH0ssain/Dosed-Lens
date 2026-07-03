/* Salvia — "reality shears into repeating strips, something pulls sideways"
   sigWarp: diagonal strip shear (N=3→9 hard-edged bands), ~7 s page-turn
            events, constant leftward skew
   sigColor: cartoon posterize (5 levels) + Sobel ink lines
   sigTemporal: stepped motion (12 fps quantize at Heavy). Full module in M4. */

vec2 sigWarp(vec2 uv){ return uv; }
vec3 sigColor(vec3 col, vec2 uv){ return col; }
vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
