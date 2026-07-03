/* Psilocybin — "the world melts and flows, organic and earthy"
   sigWarp: melt accumulator (persistent downward slump + elastic recovery)
            + radial water-ripple from brightest point
   sigColor: hue convergence toward olive/amber, glow on organic regions
   sigTemporal: soft long tracers, no rainbow. Full module in M4. */

vec2 sigWarp(vec2 uv){ return uv; }
vec3 sigColor(vec3 col, vec2 uv){ return col; }
vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
