/* P4 — color identity: posterize, bleed, saturation/desat, hue drift,
   warm/cool casts, white-out. Signature hook sigColor(col, uv) runs after
   the shared ops so a substance's color identity rides on top. */

uniform float uP_colorSat, uP_desat, uP_hueDrift, uP_colorBleed, uP_warmCast,
              uP_coolCast, uP_whiteOut, uP_posterize;

//__SIGNATURE__

void main(){
  vec3 col = scene(vUv);

  /* ---- posterize (cartoon flattening, salvia) ---- */
  if (uP_posterize > 0.004) {
    float levels = mix(14.0, 5.0, uP_posterize);
    vec3 pc = floor(col * levels + 0.5) / levels;
    col = mix(col, pc, min(uP_posterize * 1.5, 1.0));
  }

  /* ---- color bleed: chroma spreads past its edges, luma stays put ---- */
  if (uP_colorBleed > 0.004) {
    vec2 px = uP_colorBleed * 9.0 / uRes;
    vec3 spread = texture(uScene, vUv + px).rgb + texture(uScene, vUv - px).rgb
                + texture(uScene, vUv + vec2(px.x, -px.y)).rgb
                + texture(uScene, vUv - vec2(px.x, -px.y)).rgb;
    spread *= 0.25;
    float l0 = luma(col);
    vec3 bled = spread * (l0 / max(luma(spread), 0.02));
    col = mix(col, bled, uP_colorBleed * 0.6);
  }

  /* ---- saturation push / drain ---- */
  float l = luma(col);
  col = mix(vec3(l), col, 1.0 + uP_colorSat * 1.1);
  col = mix(col, vec3(l), uP_desat);

  /* ---- slow global hue drift ---- */
  if (uP_hueDrift > 0.004) {
    col = hueRot(col, sin(uTime * 0.11) * uP_hueDrift * 1.1
                    + sin(uTime * 0.043 + 1.7) * uP_hueDrift * 0.5);
  }

  /* ---- casts ---- */
  col *= mix(vec3(1.0), vec3(1.10, 1.00, 0.86), uP_warmCast);
  col *= mix(vec3(1.0), vec3(0.90, 0.98, 1.10), uP_coolCast);

  /* ---- white-out (nitrous peaks) ---- */
  if (uP_whiteOut > 0.004) {
    col = mix(col, vec3(1.04, 1.02, 0.98), uP_whiteOut);
  }

  col = sigColor(col, vUv);
  fragColor = vec4(col, 1.0);
}
