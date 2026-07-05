/* Nitrous — "everything throbs in waves, echoing, warm and dim"
   Identity: a slow global throb LFO under a ~25 s decay-and-restart
   envelope (the short arc of the experience). Reworked per PsychonautWiki:
   documented nitrous effects are acuity suppression to the point of
   blindness, double vision, frame-rate/pattern-recognition suppression,
   and — the distinctive one — "a static wall of geometry... simplistic,
   organic, colourful, soft and blurred, based on complex interlocking
   circles" appearing in front of vision at higher doses. Double vision and
   frame-lag reuse the shared P2/P5 params (uP_doubleVision/uP_stutter).
   Rewritten a third time after user feedback that it was STILL "literally
   strobing, not smooth at all" with jittery-feeling vibration at 1.1 Hz:
   unifying the phase wasn't enough — any full-field luminance/blur pulse
   reads as "flashing" almost regardless of frequency once the delta
   between trough and peak is large, because several qualities (sharpness,
   brightness, glow) all flip together into a visibly different state.
   This pass leans hard the other way: the fast-channel deltas (luminance,
   blur, glow) are now small — barely-there — and slowed further (1.1 ->
   0.55 Hz, a good two-second breath), while the WARP (pure zoom-breathing,
   no luminance/contrast change at all, so it cannot read as "flashing")
   carries most of the felt intensity instead.
   sigWarp:     the dominant carrier now — real, larger zoom-breathing
   sigColor:    luminance + blur + glow all riding the SAME wave phase, but
                each cut to a small fraction of what they were
   sigTemporal: flange — blend the history ring one throb period back
   Params: throb, envelope, flange
   sources: psychonautwiki:nitrous-oxide */

const float N2O_HZ = 0.55;

float n2oEnv(){
  /* restartable decay: hits 1 at cycle start, ~e^-1 by 9 s */
  float cyc = mod(uTime, 25.0);
  return exp(-cyc / 9.0) * uSig_envelope + (1.0 - uSig_envelope) * 0.6;
}

/* single unified wave, 0..1, envelope+intensity-scaled, peaks rounded
   (smoothstep-shaped) so there's no sharp instantaneous transition —
   everything in sigColor rides this same phase so the throb reads as one
   cohesive gradual wave rather than several staggered pulses */
float n2oWave(){
  float raw = 0.5 + 0.5 * sin(TAU * N2O_HZ * uTime);
  raw = raw * raw * (3.0 - 2.0 * raw); /* round the peaks further */
  return raw * n2oEnv() * uSig_throb * smoothstep(0.06, 0.75, uIntensity);
}

/* "a static wall of geometry... organic, colourful, soft and blurred,
   based on complex interlocking circles" — P3's shared pattern pass isn't
   phase-locked to the throb, so this bespoke layer lives directly in the
   signature and breathes with the slow envelope instead. */
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
  /* the dominant carrier of the throb now: a real, larger zoom-breathe.
     Pure geometry, no luminance/contrast change, so it cannot read as
     "flashing" no matter how large — this is where the felt intensity
     should live instead of in the color channel. */
  float s = 1.0 + n2oWave() * 0.085;
  return (uv - 0.5) / s + 0.5;
}

vec3 sigColor(vec3 col, vec2 uv){
  float wave = n2oWave(); /* 0..1, single shared phase for everything below */

  /* luminance — barely-there now; the warp carries the throb instead */
  col *= 1.0 + (wave - 0.5) * 0.10;

  /* blur pulse: small and slow — this stacked with luminance/whiteout is
     what read as "vibration"/strobing before, so it's cut hard */
  float bl = wave * 0.22;
  if (bl > 0.02) {
    vec2 px = 5.0 * bl / uRes;
    vec3 soft = ( texture(uScene, uv + px).rgb + texture(uScene, uv - px).rgb
                + texture(uScene, uv + vec2(px.x, -px.y)).rgb
                + texture(uScene, uv - vec2(px.x, -px.y)).rgb ) * 0.25;
    col = mix(col, soft, bl);
  }

  /* warm dim, strongest mid-envelope (slow, ~25s arc — unrelated to the
     fast throb, so not part of the flashing complaint) */
  float env = n2oEnv();
  float mid = env * (1.0 - env) * 4.0;
  col *= mix(vec3(1.0), vec3(0.93, 0.87, 0.78), mid * 0.5 * smoothstep(0.2, 0.8, uIntensity));

  /* Heavy: a very faint glow at wave peaks — not a strobe cue at all */
  float wo = smoothstep(0.75, 1.0, uIntensity) * wave;
  col = mix(col, vec3(1.05, 1.02, 0.96), wo * 0.08);

  /* the geometry wall — builds through the envelope, strongest at
     envelope peaks and only at higher doses (slow ~25s arc, not the
     fast throb, so it doesn't contribute to flashing) */
  float geomW = uSig_geometry * smoothstep(0.5, 1.0, uIntensity) * (0.30 + 0.70 * env);
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
  /* flange: echo of the frame one throb period ago */
  float w = uSig_flange * smoothstep(0.15, 0.7, uIntensity) * n2oEnv();
  if (w > 0.004) {
    vec3 echo = histSample(uv, 1.0 / N2O_HZ);
    col = mix(col, max(col, echo * 0.99), w * 0.5);
  }
  return col;
}
