/* MDMA — "lights bloom into stars and your eyes wiggle"
   sigColor: starburst flares on bright points, magenta sat lift, 30 Hz shimmer
   sigWarp: episodic nystagmus (0.3 s bursts @ 8 Hz, random onsets)
   Heavy: slight double vision + low-weight peripheral flicker.
   Full module in M5. */

vec2 sigWarp(vec2 uv){ return uv; }
vec3 sigColor(vec3 col, vec2 uv){ return col; }
vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
