/* Nitrous — "everything throbs in waves, echoing, warm and dim"
   Identity: a 2.5 Hz global throb LFO under a ~25 s decay-and-restart
   envelope (the short arc of the experience). Reworked per PsychonautWiki:
   documented nitrous effects are acuity suppression to the point of
   blindness, double vision, frame-rate/pattern-recognition suppression,
   and — the distinctive one — "a static wall of geometry... simplistic,
   organic, colourful, soft and blurred, based on complex interlocking
   circles" appearing in front of vision at higher doses. Double vision and
   frame-lag reuse the shared P2/P5 params (uP_doubleVision/uP_stutter);
   the geometry reuses P3's image-masked form-constant lattice
   (uP_patternMask) rather than inventing a second pattern system.
   sigWarp:     scale pulses hard on the LFO — the throb should be felt as
                actual zoom-breathing, not just a brightness flicker
   sigColor:    luminance pulse, quadrature-phase blur pulse (now strong
                enough to read as acuity suppression), warm dim mid-
                envelope, near-blindness whiteout at Heavy LFO peaks
   sigTemporal: flange — blend the history ring one throb period back
   Params: throb, envelope, flange
   sources: psychonautwiki:nitrous-oxide */

float n2oEnv(){
  /* restartable decay: hits 1 at cycle start, ~e^-1 by 9 s */
  float cyc = mod(uTime, 25.0);
  return exp(-cyc / 9.0) * uSig_envelope + (1.0 - uSig_envelope) * 0.6;
}
float n2oLFO(float phase){
  return sin(TAU * 2.5 * uTime + phase) * n2oEnv()
       * uSig_throb * smoothstep(0.06, 0.75, uIntensity);
}

/* "a static wall of geometry... organic, colourful, soft and blurred,
   based on complex interlocking circles" — P3's shared pattern pass isn't
   phase-locked to the throb LFO, so this bespoke layer lives directly in
   the signature and breathes with the envelope instead. */
float n2oGeom(vec2 p){
  float g = 0.0;
  for (int i = 0; i < 4; i++){
    float fi = float(i);
    vec2 c = 0.5 * vec2(cos(fi * 2.4 + uTime * 0.025), sin(fi * 1.7 - uTime * 0.02));
    float r = length(p - c);
    float ring = 0.5 + 0.5 * sin(r * 9.0 - uTime * 0.5 + fi * 2.1);
    g += smoothstep(0.10, 0.90, ring) * 0.25;
  }
  return g;
}

vec2 sigWarp(vec2 uv){
  /* real zoom-breathing on the throb, not a barely-there wobble */
  float s = 1.0 + max(n2oLFO(0.0), 0.0) * 0.055;
  return (uv - 0.5) / s + 0.5;
}

vec3 sigColor(vec3 col, vec2 uv){
  float th = n2oLFO(0.0);
  float thQ = n2oLFO(PI * 0.5); /* 90° out of phase */

  /* luminance throb — much more felt */
  col *= 1.0 + th * 0.42;

  /* blur pulse: acuity suppression on the quadrature phase, strong enough
     to read as "blurred vision to the point of all-encompassing
     blindness" at the top of the swing */
  float bl = min(max(thQ, 0.0) * 1.35, 1.0);
  if (bl > 0.02) {
    vec2 px = 11.0 * bl / uRes;
    vec3 soft = ( texture(uScene, uv + px).rgb + texture(uScene, uv - px).rgb
                + texture(uScene, uv + vec2(px.x, -px.y)).rgb
                + texture(uScene, uv - vec2(px.x, -px.y)).rgb ) * 0.25;
    vec3 soft2 = ( texture(uScene, uv + px * 2.0).rgb + texture(uScene, uv - px * 2.0).rgb ) * 0.5;
    col = mix(col, mix(soft, soft2, bl * 0.5), bl);
  }

  /* warm dim, strongest mid-envelope */
  float env = n2oEnv();
  float mid = env * (1.0 - env) * 4.0;
  col *= mix(vec3(1.0), vec3(0.93, 0.87, 0.78), mid * 0.5 * smoothstep(0.2, 0.8, uIntensity));

  /* Heavy: near-whiteout blindness at LFO peaks */
  float wo = smoothstep(0.68, 1.0, uIntensity) * pow(max(th, 0.0), 2.2);
  col = mix(col, vec3(1.05, 1.02, 0.96), wo * 0.78);

  /* the geometry wall — builds through the envelope, strongest at LFO
     peaks and only at higher doses */
  float geomW = uSig_geometry * smoothstep(0.5, 1.0, uIntensity) * (0.30 + 0.70 * n2oEnv());
  if (geomW > 0.004) {
    vec2 asp = vec2(uAspect, 1.0);
    vec2 p = (uv - 0.5) * asp;
    float g = n2oGeom(p);
    float l = lumAt(uv, 3.0);
    float lumMask = smoothstep(0.03, 0.20, l) * (1.0 - smoothstep(0.70, 0.97, l));
    vec3 gcol = pal(g * 0.6 + uTime * 0.015, vec3(0.55, 0.5, 0.6), vec3(0.45),
                     vec3(0.8, 0.9, 1.0), vec3(0.1, 0.2, 0.4));
    col = mix(col, col * 0.5 + gcol * 0.9, geomW * lumMask * (0.4 + 0.6 * g));
  }
  return col;
}

vec3 sigTemporal(vec3 col, vec2 uv){
  /* flange: echo of the frame one throb period (0.4 s) ago */
  float w = uSig_flange * smoothstep(0.15, 0.7, uIntensity) * n2oEnv();
  if (w > 0.004) {
    vec3 echo = histSample(uv, 0.4);
    col = mix(col, max(col, echo * 0.99), w * 0.5);
  }
  return col;
}
