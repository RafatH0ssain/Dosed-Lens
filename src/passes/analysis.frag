/* P1 — image analysis, cached per image (re-run only on image/resize change).
   uMode 0 → edges target: RG = Sobel gradient direction, B = magnitude, A = luminance
   uMode 1 → luminance target (mipmapped after render → blur pyramid) */

uniform int uMode;

float srcLum(vec2 uv){
  return luma(texture(uSrc, fitUV(uv)).rgb);
}

void main(){
  if (uMode == 1) {
    float l = srcLum(vUv);
    fragColor = vec4(l, l, l, 1.0);
    return;
  }
  vec2 px = 1.0 / uRes;
  float tl = srcLum(vUv + px*vec2(-1, 1)), t = srcLum(vUv + px*vec2(0, 1)), tr = srcLum(vUv + px*vec2(1, 1));
  float ml = srcLum(vUv + px*vec2(-1, 0)), mc = srcLum(vUv),                mr = srcLum(vUv + px*vec2(1, 0));
  float bl = srcLum(vUv + px*vec2(-1,-1)), b = srcLum(vUv + px*vec2(0,-1)), br = srcLum(vUv + px*vec2(1,-1));
  float gx = (tr + 2.0*mr + br) - (tl + 2.0*ml + bl);
  float gy = (tl + 2.0*t + tr) - (bl + 2.0*b + br);
  vec2 g = vec2(gx, gy);
  float mag = length(g);
  vec2 dir = mag > 1e-5 ? g / mag : vec2(0.0);
  /* dir packed to 0..1 range for RGBA8 storage */
  fragColor = vec4(dir * 0.5 + 0.5, clamp(mag * 1.5, 0.0, 1.0), mc);
}
