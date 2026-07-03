/* P6 — acuity: blur fields, unsharp halo ("HD" look), ghosting, DoF
   collapse. Blur is a rotated poisson tap ring on uScene.
   Gated by: acuity, sharpenHalo, ghosting, dof. */

uniform float uP_acuity, uP_sharpenHalo, uP_ghosting, uP_dof;

vec3 blurTap(vec2 uv, float radiusPx){
  const vec2 taps[12] = vec2[](
    vec2(-0.326,-0.406), vec2(-0.840,-0.074), vec2(-0.696, 0.457),
    vec2(-0.203, 0.621), vec2( 0.962,-0.195), vec2( 0.473,-0.480),
    vec2( 0.519, 0.767), vec2( 0.185,-0.893), vec2( 0.507, 0.064),
    vec2( 0.896, 0.412), vec2(-0.322,-0.933), vec2(-0.792,-0.598));
  vec2 px = radiusPx / uRes;
  vec3 acc = texture(uScene, uv).rgb;
  for (int i = 0; i < 12; i++) acc += texture(uScene, uv + taps[i]*px).rgb;
  return acc / 13.0;
}

void main(){
  vec3 col = scene(vUv);
  vec2 c = vUv - 0.5;
  float r2 = dot(c, c);

  /* ---- blur field + DoF collapse (blur grows outward from center) ---- */
  float blurAmt = clamp(uP_acuity + uP_dof * r2 * 3.2, 0.0, 1.0);
  if (blurAmt > 0.01) {
    float radius = blurAmt * 9.0;
    vec3 soft = blurTap(vUv, radius);
    /* second ring for heavy blur so it doesn't ring */
    if (blurAmt > 0.5) soft = mix(soft, blurTap(vUv, radius*2.2), (blurAmt-0.5)*1.6);
    col = mix(col, soft, min(blurAmt * 1.4, 1.0));
  }

  /* ---- unsharp halo: the over-crisp "HD" look (LSD/meth) ---- */
  if (uP_sharpenHalo > 0.004) {
    vec3 soft = blurTap(vUv, 5.0);
    vec3 hi = col - soft;
    col += clamp(hi, -0.25, 0.25) * uP_sharpenHalo * 1.6;
  }

  /* ---- ghosting: offset echo of the temporal history ---- */
  if (uP_ghosting > 0.004) {
    vec3 ghost = texture(uPrev, vUv + vec2(0.005, 0.0)).rgb;
    col = mix(col, max(col, ghost * 0.96), uP_ghosting * 0.5);
  }

  fragColor = vec4(col, 1.0);
}
