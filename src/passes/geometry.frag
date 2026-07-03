/* P2 — geometric distortion. Pipeline entry: samples uSrc with cover-fit.
   All warps are driven by the image's own structure (P1 fields), never by
   screen-space overlays:
     breathing    — displacement along the *smooth* luminance gradient
                    (pyramid mip), so surfaces bow along their own contours
     drift        — slow crawl along the smooth tangent field
     flowWarp     — traveling wave along the *fine* Sobel tangent, amplitude
                    ∝ edge magnitude: lines (mortar!) crawl along themselves
     doubleVision — horizontal two-tap diplopia (vertical variants live in
                    signature modules)
     jitter       — whole-frame micro shake
     sway         — frame roll oscillation
   Signature hook: sigWarp(uv) runs before the shared warps. */

uniform float uP_breathing, uP_drift, uP_flowWarp, uP_doubleVision, uP_jitter, uP_sway;

/* smooth gradient of the luminance pyramid at a given mip (soft structure) */
vec2 lumGrad(vec2 uv, float mip){
  vec2 px = exp2(mip) / uRes;
  float l = textureLod(uLum, uv - vec2(px.x, 0.0), mip).r;
  float r = textureLod(uLum, uv + vec2(px.x, 0.0), mip).r;
  float b = textureLod(uLum, uv - vec2(0.0, px.y), mip).r;
  float t = textureLod(uLum, uv + vec2(0.0, px.y), mip).r;
  return vec2(r - l, t - b);
}

vec3 sampleSrc(vec2 uv){ return texture(uSrc, fitUV(uv)).rgb; }

//__SIGNATURE__

void main(){
  vec2 uv = vUv;
  vec2 asp = vec2(uAspect, 1.0);

  /* ---- sway: gentle roll around the frame center ---- */
  if (uP_sway > 0.0) {
    float ang = uP_sway * 0.026 * sin(uTime * 0.15 * TAU)
              + uP_sway * 0.008 * sin(uTime * 0.41 * TAU + 1.7);
    vec2 c = (uv - 0.5) * asp;
    uv = rot2(c, ang) / asp + 0.5;
  }

  /* ---- jitter: per-frame micro shake ---- */
  if (uP_jitter > 0.0) {
    float ft = floor(uTime * 60.0);
    uv += (vec2(hash1(ft * 1.37), hash1(ft * 2.11 + 5.0)) - 0.5) * 0.004 * uP_jitter;
  }

  /* ---- signature geometric identity ---- */
  uv = sigWarp(uv);

  /* ---- breathing: bow surfaces along their own smooth contours ---- */
  if (uP_breathing > 0.0) {
    vec2 g = lumGrad(uv, 4.0);
    float gm = length(g);
    vec2 n = gm > 1e-5 ? g / gm : vec2(0.0);
    float structure = smoothstep(0.0, 0.06, gm);
    float lum = textureLod(uLum, uv, 3.0).r;
    float phase = uTime * 0.45 + lum * 5.0 + (uv.x + uv.y) * 3.0;
    /* slow secondary wave so it never settles into a loop */
    float w = sin(phase) * 0.75 + sin(phase * 0.37 + 2.1) * 0.25;
    uv -= n * w * structure * uP_breathing * 0.012;
  }

  /* ---- drift: slow crawl along smooth tangents ---- */
  if (uP_drift > 0.0) {
    vec2 g = lumGrad(uv, 3.0);
    vec2 tan2 = vec2(-g.y, g.x);
    float gm = length(tan2);
    if (gm > 1e-5) tan2 /= gm;
    float structure = smoothstep(0.0, 0.05, gm);
    float w = sin(uTime * 0.22 + fbm(uv * 3.0 + uTime * 0.05) * 4.0);
    uv += tan2 * w * structure * uP_drift * 0.008;
  }

  /* ---- flowWarp: fine edges crawl along themselves ---- */
  if (uP_flowWarp > 0.0) {
    vec4 e = edgeAt(uv);
    vec2 dir = e.xy * 2.0 - 1.0;
    vec2 tan1 = vec2(-dir.y, dir.x);
    float mag = e.z;
    /* traveling wave phase measured along the tangent → bumps slide down the line */
    float along = dot(uv * asp, tan1);
    float w = sin(along * 90.0 - uTime * 1.6) * 0.6
            + sin(along * 41.0 - uTime * 0.9 + 1.3) * 0.4;
    uv += tan1 * w * mag * uP_flowWarp * 0.006;
  }

  /* ---- final sample (+ horizontal diplopia) ---- */
  vec3 col;
  if (uP_doubleVision > 0.0) {
    float off = uP_doubleVision * 0.018 * (0.6 + 0.4 * sin(uTime * 0.3 * TAU));
    col = mix(sampleSrc(uv - vec2(off, 0.0)), sampleSrc(uv + vec2(off, 0.0)), 0.5);
  } else {
    col = sampleSrc(uv);
  }
  fragColor = vec4(col, 1.0);
}
