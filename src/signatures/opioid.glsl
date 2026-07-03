/* Opioid (nod) — "warm, golden, pinholed — the lights keep going out"
   Identity: nod state machine AWAKE → NODDING (lid descends, blur, sink,
   time slows) → SNAP (0.3 s over-bright refocus) → AWAKE. CPU-driven phase.
   Constant: golden cast, pinhole vignette 80%→55%. Full module in M5. */

vec2 sigWarp(vec2 uv){ return uv; }
vec3 sigColor(vec3 col, vec2 uv){ return col; }
vec3 sigTemporal(vec3 col, vec2 uv){ return col; }
