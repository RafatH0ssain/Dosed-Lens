/* Nitrous — "everything throbs in waves, echoing, warm and dim"
   Identity: a 2.5 Hz global throb LFO under a ~25 s decay-and-restart
   envelope (the short arc of the experience).
   sigWarp:     scale pulses 1.000→1.015 on the LFO
   sigColor:    luminance pulse on the LFO, blur pulse 90° out of phase,
                warm dim strongest mid-envelope, white-out at Heavy peaks
   sigTemporal: flange — blend the history ring one throb period back
   Params: throb, envelope, flange */

float n2oEnv(){
  /* restartable decay: hits 1 at cycle start, ~e^-1 by 9 s */
  float cyc = mod(uTime, 25.0);
  return exp(-cyc / 9.0) * uSig_envelope + (1.0 - uSig_envelope) * 0.6;
}
float n2oLFO(float phase){
  return sin(TAU * 2.5 * uTime + phase) * n2oEnv()
       * uSig_throb * smoothstep(0.06, 0.75, uIntensity);
}

vec2 sigWarp(vec2 uv){
  float s = 1.0 + max(n2oLFO(0.0), 0.0) * 0.015;
  return (uv - 0.5) / s + 0.5;
}

vec3 sigColor(vec3 col, vec2 uv){
  float th = n2oLFO(0.0);
  float thQ = n2oLFO(PI * 0.5); /* 90° out of phase */

  /* luminance throb */
  col *= 1.0 + th * 0.22;

  /* blur pulse: soften on the quadrature phase */
  float bl = max(thQ, 0.0) * 0.9;
  if (bl > 0.02) {
    vec2 px = 6.0 * bl / uRes;
    vec3 soft = ( texture(uScene, uv + px).rgb + texture(uScene, uv - px).rgb
                + texture(uScene, uv + vec2(px.x, -px.y)).rgb
                + texture(uScene, uv - vec2(px.x, -px.y)).rgb ) * 0.25;
    col = mix(col, soft, bl);
  }

  /* warm dim, strongest mid-envelope */
  float env = n2oEnv();
  float mid = env * (1.0 - env) * 4.0;
  col *= mix(vec3(1.0), vec3(0.93, 0.87, 0.78), mid * 0.5 * smoothstep(0.2, 0.8, uIntensity));

  /* Heavy: near-whiteout at LFO peaks */
  float wo = smoothstep(0.78, 1.0, uIntensity) * pow(max(th, 0.0), 3.0);
  col = mix(col, vec3(1.05, 1.02, 0.96), wo * 0.55);
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
