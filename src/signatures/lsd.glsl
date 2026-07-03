/* LSD — "sharper than reality, geometry living in textures"
   sigWarp: edge-tangent drift (lines crawl along themselves)
   sigColor: HD unsharp-halo + saturation push; Heavy adds fractal tiling
   sigTemporal: rainbow trails (+12°/frame hue-advanced feedback)
   Params: hdSharpen, fractalTile, rainbowTrail. Full module in M3. */

vec2 sigWarp(vec2 uv){ return uv; }
vec3 sigColor(vec3 col, vec2 uv){ return col; }
vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
