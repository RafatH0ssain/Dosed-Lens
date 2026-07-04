/* Melt accumulator (psilocybin) — low-res persistent ping-pong.
   R channel accumulates downward slump where the image has luminance
   gradient to grab onto, on an ~20 s asynchronous regional cycle, and
   elastically relaxes when its region's phase turns negative. Runs only
   while a substance sets FrameState.flow > 0. */

uniform float uFlowRate;

void main(){
  float f = texture(uFlow, vUv).r;
  float g = edgeAt(vUv).z;
  /* regional phase — different areas slump and recover out of step */
  float phase = sin(uTime * TAU / 20.0 + fbm(vUv * 3.0) * 4.0);
  float grow = max(phase, 0.0) * smoothstep(0.05, 0.4, g) * uDt * 0.10 * uFlowRate;
  float decay = 0.10 + 0.30 * max(-phase, 0.0);
  f = f * exp(-uDt * decay) + grow;
  fragColor = vec4(clamp(f, 0.0, 1.0), 0.0, 0.0, 1.0);
}
