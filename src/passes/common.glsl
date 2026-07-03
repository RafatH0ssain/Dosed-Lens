/* Shared preamble prepended to every pass program (see gl/program.ts).
   Declares the universal uniform context + helper library ported from
   ref/phenomenon.html. Pass bodies and signature modules build on this. */

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uScene;  /* previous pass output (entry pass: cover-fit src) */
uniform sampler2D uSrc;    /* original uploaded image */
uniform sampler2D uEdges;  /* P1: RG = Sobel dir, B = magnitude, A = luminance */
uniform sampler2D uLum;    /* P1: luminance, blur pyramid in mips */
uniform sampler2D uPrev;   /* previous final frame */

uniform vec2  uRes;        /* render target size in px */
uniform float uAspect;     /* uRes.x / uRes.y */
uniform float uTime;       /* seconds, pause-aware */
uniform float uDt;
uniform float uIntensity;  /* 0..1 slider */
uniform float uTier[5];    /* triangular weights over Threshold..Heavy stops */
uniform vec2  uMouse;      /* 0..1, y up */
uniform vec4  uFit;        /* cover-fit: uv*uFit.xy + uFit.zw → src uv */
uniform vec4  uSeedCol[4]; /* 4 dominant image colors (analysis, M0 CPU-side) */

#define PI 3.14159265359
#define TAU 6.28318530718

/* ---- hash & noise (ported from ref/phenomenon.html) ---- */
float hash1(float n){ return fract(sin(n)*43758.5453123); }
float hash12(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
vec2 hash2(vec2 p){
  p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
  return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix( mix(dot(hash2(i+vec2(0,0)), f-vec2(0,0)),
                  dot(hash2(i+vec2(1,0)), f-vec2(1,0)), u.x),
              mix(dot(hash2(i+vec2(0,1)), f-vec2(0,1)),
                  dot(hash2(i+vec2(1,1)), f-vec2(1,1)), u.x), u.y );
}
float fbm(vec2 p){
  float a = 0.5, s = 0.0;
  mat2 R = mat2(0.8,0.6,-0.6,0.8);
  for(int i=0;i<6;i++){ s += a*noise(p); p = R*p*2.03 + 11.7; a *= 0.5; }
  return s;
}

/* ---- color helpers ---- */
vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b*cos(TAU*(c*t+d)); }
vec3 hueRot(vec3 c, float a){
  const vec3 k = vec3(0.57735);
  float ca = cos(a), sa = sin(a);
  return c*ca + cross(k,c)*sa + k*dot(k,c)*(1.0-ca);
}
float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }

/* ---- sampling helpers ---- */
vec2 fitUV(vec2 uv){ return uv*uFit.xy + uFit.zw; }
vec3 scene(vec2 uv){ return texture(uScene, uv).rgb; }
/* edge field: xy = direction (unit gradient), z = magnitude, w = luminance */
vec4 edgeAt(vec2 uv){ return texture(uEdges, uv); }
/* tangent along which lines run (perpendicular to gradient) */
vec2 edgeTangent(vec2 uv){ vec4 e = edgeAt(uv); return vec2(-e.y, e.x); }
float lumAt(vec2 uv, float mip){ return textureLod(uLum, uv, mip).r; }

/* rotate a 2D point */
vec2 rot2(vec2 p, float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c)*p; }
