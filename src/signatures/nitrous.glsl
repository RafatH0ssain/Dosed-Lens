/* Nitrous — "everything throbs in waves, echoing, warm and dim"
   Identity: 2.5 Hz global throb LFO with 25 s decay-and-restart envelope.
   sigWarp: scale pulse 1.00→1.015 on LFO
   sigColor: luminance + blur pulse (90° phase), warm dim mid-envelope
   sigTemporal: phase-picked frame echo from history ring, sparkle bursts.
   Full module in M4. */

vec2 sigWarp(vec2 uv){ return uv; }
vec3 sigColor(vec3 col, vec2 uv){ return col; }
vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
