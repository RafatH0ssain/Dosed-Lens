/* Null signature — all pass-through. Shared params alone must produce a
   working substance during bring-up (spec §4). */

vec2 sigWarp(vec2 uv){ return uv; }
vec3 sigColor(vec3 col, vec2 uv){ return col; }
vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
