/* P3 — form constants + entity phenomena, masked INTO the photo.
   Pattern math, mandala, eye/face/jester SDFs ported from
   ref/phenomenon.html (SIM shader). The pattern is never a screen-space
   overlay: it is gated by the image's own mid-frequency texture energy and
   midtone luminance, so it lives inside surfaces and stays out of
   highlights and hard object boundaries.
   Gated by: patternMask. Entity/mandala uniforms are driven per-substance
   (DMT breakthrough, M4); they default to 0 elsewhere. */

uniform float uP_patternMask, uP_symmetry;
uniform float uEntity, uEyes, uFaces, uJester, uMandala, uPatternBoost, uBreakthrough;

/* ---- ported: triple domain warp — the organic 'liquid' motion ---- */
float field(vec2 p, float t, float warp, out vec2 q, out vec2 r){
  q = vec2( fbm(p + 0.10*t), fbm(p + vec2(5.2, 1.3) - 0.07*t) );
  r = vec2( fbm(p + 3.2*q + vec2(1.7, 9.2) + 0.15*t),
            fbm(p + 3.2*q + vec2(8.3, 2.8) - 0.12*t) );
  return fbm(p + 3.0*r*warp + 0.5*q);
}

/* ---- ported: kaleidoscopic fold ---- */
vec2 kalei(vec2 p, float n){
  float a = atan(p.y, p.x);
  float seg = TAU / n;
  a = mod(a, seg);
  a = abs(a - seg*0.5);
  return vec2(cos(a), sin(a)) * length(p);
}

/* ---- ported: Kluver form constants ---- */
vec2 tunnelMap(vec2 p, float t){
  float r = length(p) + 1e-4;
  return vec2( atan(p.y,p.x)/PI, 0.35/r + t*0.15 );
}
vec2 spiralMap(vec2 p, float t){
  float r = length(p) + 1e-4;
  float a = atan(p.y,p.x) + log(r)*2.6 + t*0.12;
  return vec2(cos(a), sin(a))*r;
}
float lattice(vec2 p){
  float v = 0.0;
  for(int i=0;i<3;i++){
    float a = float(i)*PI/3.0;
    v += cos(dot(p, vec2(cos(a),sin(a)))*8.0);
  }
  return v/3.0;
}

/* ---- ported: almond eye SDF (vesica) ---- */
float sdVesica(vec2 p, float r, float d){
  p = abs(p);
  float b = sqrt(max(r*r - d*d, 1e-4));
  return ((p.y-b)*d > p.x*b) ? length(p-vec2(0.0,b)) : length(p-vec2(-d,0.0))-r;
}

/* ---- ported: a single watching eye ---- */
vec3 drawEye(vec2 q, float s, float t, float seed){
  q /= s;
  if(dot(q,q) > 2.5) return vec3(0.0);
  float open = clamp(smoothstep(0.02, 0.16, abs(sin(t*0.45 + seed*17.0))), 0.05, 1.0);
  vec2 e = vec2(q.x, q.y/open);
  float lid = sdVesica(e.yx, 1.0, 0.55);
  float inside = smoothstep(0.03, -0.01, lid);
  float r = length(e);
  vec3 col = vec3(0.0);
  col += inside * vec3(0.75,0.72,0.95)*0.30;
  float iris = smoothstep(0.52, 0.48, r);
  float ring = 0.5 + 0.5*cos(r*40.0 - t*1.5 + atan(e.y,e.x)*7.0 + seed*30.0);
  vec3 irisCol = pal(ring*0.25 + seed*0.7 + t*0.02,
                     vec3(0.45), vec3(0.45), vec3(1.0,0.7,0.4), vec3(0.0,0.25,0.55));
  col = mix(col, irisCol*1.15, inside*iris);
  float pr = 0.20 + 0.07*sin(t*0.3 + seed*9.0);
  float pup = smoothstep(pr+0.02, pr, r);
  col = mix(col, vec3(0.01,0.0,0.03), inside*pup);
  col += inside*iris*smoothstep(0.06,0.0,length(e-vec2(0.14,0.15)))*0.8;
  col += smoothstep(0.05,0.0,abs(lid))*vec3(0.55,0.30,0.85)*0.6*open;
  return col;
}

/* ---- ported: an emergent face ---- */
vec3 drawFace(vec2 q, float s, float t, float seed){
  q /= s;
  if(dot(q,q) > 3.2) return vec3(0.0);
  vec3 col = vec3(0.0);
  vec2 oq = q*vec2(1.0,0.82);
  float wob = 0.06*sin(atan(q.y,q.x)*5.0 + t*0.4 + seed*10.0);
  float face = abs(length(oq)-1.0-wob) - 0.02;
  col += smoothstep(0.06,0.0,face)*vec3(0.45,0.30,0.75)*0.55;
  col += drawEye(q-vec2(-0.42,0.28), 0.30, t, seed);
  col += drawEye(q-vec2( 0.42,0.28), 0.30, t, seed+0.31);
  vec2 b1 = q-vec2(-0.42,0.52); vec2 b2 = q-vec2(0.42,0.52);
  col += smoothstep(0.025,0.0, abs(length(b1*vec2(1.0,1.8))-0.28))*step(0.0,b1.y)*vec3(0.5,0.3,0.8)*0.5;
  col += smoothstep(0.025,0.0, abs(length(b2*vec2(1.0,1.8))-0.28))*step(0.0,b2.y)*vec3(0.5,0.3,0.8)*0.5;
  vec2 mq = q-vec2(0.0,-0.38 - 0.05*sin(t*0.2+seed*5.0));
  float mouth = abs(length(mq*vec2(1.0,1.3+0.5*sin(t*0.15+seed)))-0.34)-0.022;
  col += smoothstep(0.03,0.0,mouth)*step(mq.y,-0.02)*vec3(0.7,0.35,0.9)*0.7;
  return col;
}

/* ---- ported: the jester ---- */
vec3 drawJester(vec2 q, float s, float t){
  q /= s;
  if(dot(q,q) > 4.5) return vec3(0.0);
  vec3 col = vec3(0.0);
  vec2 dq = q*7.0 + vec2(0.0, t*0.15);
  float diam = step(0.0, sin(dq.x+dq.y)*sin(dq.x-dq.y));
  vec3 motA = hueRot(vec3(0.85,0.10,0.45), t*0.1);
  vec3 motB = hueRot(vec3(0.10,0.65,0.60), t*0.1);
  vec3 motley = mix(motA, motB, diam);

  vec2 hq = q - vec2(0.0, 0.62);
  float ha = atan(hq.x, hq.y);
  float rHat = 0.22 + 0.62*pow(max(cos(ha*5.0),0.0), 2.0);
  float hat = length(hq) - rHat;
  float hatm = smoothstep(0.02,-0.01,hat) * step(abs(ha), 1.5) * step(0.0, hq.y+0.15);
  col += hatm * motley;
  col += smoothstep(0.06,0.02,length(hq - vec2(0.0,0.86)))*vec3(1.2,1.1,0.5);
  col += smoothstep(0.06,0.02,length(hq - 0.80*vec2(sin(1.05),cos(1.05))))*vec3(1.2,1.1,0.5);
  col += smoothstep(0.06,0.02,length(hq - 0.80*vec2(sin(-1.05),cos(-1.05))))*vec3(1.2,1.1,0.5);

  float fd = abs(q.x)/0.62 + abs(q.y)/0.85 - 1.0;
  float fm = smoothstep(0.02,-0.01,fd);
  vec3 skin = mix(vec3(0.92,0.88,0.98), motley, 0.18);
  col = mix(col, skin, fm);
  col = mix(col, col*mix(vec3(1.15,0.85,1.05), vec3(0.85,1.05,1.15), step(0.0,q.x)), fm);

  float e1 = abs(q.x+0.24)/0.10 + abs(q.y-0.16)/0.14 - 1.0;
  float e2 = abs(q.x-0.24)/0.10 + abs(q.y-0.16)/0.14 - 1.0;
  col = mix(col, vec3(0.02,0.0,0.05), fm*smoothstep(0.02,-0.02,e1));
  col = mix(col, vec3(0.02,0.0,0.05), fm*smoothstep(0.02,-0.02,e2));
  col += fm*smoothstep(0.03,0.0,length(q-vec2(-0.22,0.19)))*vec3(1.5);
  col += fm*smoothstep(0.03,0.0,length(q-vec2( 0.26,0.19)))*vec3(1.5);

  vec2 mq = q - vec2(0.0,-0.18);
  float grin = abs(length(mq*vec2(0.85,1.6))-0.40)-0.035;
  float gm = smoothstep(0.03,-0.01,grin)*step(mq.y,-0.02);
  col = mix(col, vec3(0.05,0.0,0.08), fm*gm);
  float teeth = step(0.5, fract(atan(mq.y,mq.x)*4.0));
  col += fm*gm*teeth*vec3(0.9,0.85,1.0)*0.55;

  return col;
}

/* ---- ported: chrysanthemum mandala ---- */
vec3 mandala(vec2 p, float t){
  float r = length(p), a = atan(p.y,p.x);
  float pet  = cos(a*12.0 + sin(r*8.0 - t*0.8)*2.0) * cos(a*6.0 - t*0.25);
  float pet2 = cos(a*24.0 - r*14.0 + t*0.6);
  float rings= cos(r*22.0 - t*1.6);
  float m = pet*0.45 + pet2*0.25 + rings*0.30;
  float fall = exp(-r*r*1.4);
  vec3 c = pal(m*0.35 + r*0.6 + t*0.04,
               vec3(0.5), vec3(0.5), vec3(0.9,1.0,0.7), vec3(0.05,0.35,0.65));
  return c * smoothstep(0.15, 0.85, m*0.5+0.5) * fall * 1.6;
}

void main(){
  vec3 sc = scene(vUv);
  float w = uP_patternMask;
  if (w < 0.004 && uEntity < 0.004 && uMandala < 0.004 && uBreakthrough < 0.004) {
    fragColor = vec4(sc, 1.0);
    return;
  }
  float t = uTime;
  /* kaleidoscope / form-constant centre follows the cursor (M6.5) */
  vec2 p = (vUv - uMouse) * vec2(uAspect, 1.0);

  /* ---- ported form-constant morph cycle ---- */
  float cyc = fract(t*0.008);
  float wLat = smoothstep(0.05,0.25,cyc)*(1.0-smoothstep(0.30,0.50,cyc));
  float wSpi = smoothstep(0.30,0.50,cyc)*(1.0-smoothstep(0.55,0.75,cyc));
  float wTun = smoothstep(0.55,0.75,cyc)*(1.0-smoothstep(0.85,0.98,cyc));

  float symEff = clamp(uP_symmetry, 0.0, 1.0);
  float nSeg = 6.0 + 3.0*sin(t*0.05) + 2.0*sin(t*0.013);
  vec2 pk = mix(p, kalei(p, floor(nSeg)+1.0), clamp(symEff*1.4,0.0,1.0));

  vec2 pf = pk;
  pf = mix(pf, spiralMap(pk,t), wSpi*symEff);
  pf = mix(pf, tunnelMap(pk,t)*2.2, wTun*symEff);

  /* ---- layered warped field ---- */
  vec2 q, r;
  float f  = field(pf*1.6, t, w, q, r);
  float f2 = field(pf*3.4 + 7.0, t*1.3, w, q, r);
  float lat = lattice(pk*1.5 + q*2.0 + t*0.02);

  float sig = f*0.65 + f2*0.35;
  /* in the photo context the lattice rides on texture, not only the cycle */
  sig = mix(sig, sig*0.55 + lat*0.45, max(wLat*symEff, w*0.35));
  sig += 0.06*sin(40.0*sig + t*2.0) * w;

  /* ---- ported palette ---- */
  float R = length(p);
  float hueBase = t*0.05 + R*0.35 + q.x*0.6;
  vec3 pat = pal(sig*1.4 + hueBase,
                 vec3(0.52,0.50,0.53), vec3(0.48,0.50,0.47),
                 vec3(1.00,0.87,0.61), vec3(0.00,0.15,0.42));
  float edgeGlow = pow(1.0-abs(sin(sig*14.0 + t*0.6)), 6.0);
  pat += edgeGlow * hueRot(vec3(0.9,0.5,1.2), t*0.2) * (0.35+0.65*w);

  /* ---- image-structure mask: this is what keeps it out of overlay-land ---- */
  float l = lumAt(vUv, 0.0);
  float midband = abs(lumAt(vUv, 2.0) - lumAt(vUv, 5.0));
  float texEnergy = smoothstep(0.015, 0.12, midband);
  float lumMask = smoothstep(0.04, 0.22, l) * (1.0 - smoothstep(0.72, 0.95, l));
  float hardEdge = edgeAt(vUv).z;
  float mask = w * lumMask * mix(0.30, 1.0, texEnergy) * (1.0 - hardEdge*0.55);
  mask *= 0.5 + 0.5*uPatternBoost;

  /* tint the pattern toward the photo's local color so it inhabits surfaces */
  vec3 chroma = sc / max(luma(sc), 0.05);
  pat = mix(pat, pat * chroma, 0.55);

  vec3 col = sc + pat * mask * 0.85;

  /* ---- DMT breakthrough: the scene is REPLACED by tunnel space, its
     palette seeded from the photo's own dominant colors ---- */
  if (uBreakthrough > 0.001) {
    vec2 pk2 = kalei(p, 8.0 + 4.0*sin(t*0.05));
    vec2 pt = tunnelMap(pk2, t*2.0) * 2.2;
    vec2 q2, r2v;
    float ft = field(pt*1.8, t*1.6, 0.9, q2, r2v);
    vec3 pa = mix(vec3(0.50), uSeedCol[1].rgb, 0.55);
    vec3 pc = mix(vec3(1.00, 0.90, 0.60), uSeedCol[0].rgb + 0.3, 0.5);
    vec3 pdv = mix(vec3(0.00, 0.15, 0.42), uSeedCol[2].rgb, 0.5);
    vec3 tcol = pal(ft*1.6 + length(pk2)*0.5 + t*0.06, pa, vec3(0.5), pc, pdv);
    float tedge = pow(1.0 - abs(sin(ft*16.0 + t)), 5.0);
    tcol += tedge * mix(vec3(1.0, 0.6, 1.2), uSeedCol[3].rgb * 2.0, 0.4);
    tcol += mandala(p, t) * 1.2;
    col = mix(col, tcol, uBreakthrough);
  }

  /* ---- entity layer + mandala (driven by substance modules, e.g. DMT) ---- */
  if (uEntity > 0.001) {
    vec3 eCol = vec3(0.0);
    float coh = smoothstep(-0.1, 0.35, sig);
    if (uEyes > 0.5) {
      for(int i=0;i<6;i++){
        float fi = float(i);
        float ea = fi*1.047 + t*0.04 + hash1(fi*3.1)*6.28;
        float er = 0.55 + 0.55*hash1(fi*7.7) + 0.15*sin(t*0.1+fi);
        vec2 ep = pk - er*vec2(cos(ea), sin(ea));
        float vis = smoothstep(0.35, 0.75, noise(vec2(fi*13.7, t*0.09)) * 0.5 + 0.5);
        eCol += drawEye(ep, 0.16 + 0.08*hash1(fi*5.3), t, fi*0.37) * vis * 0.85;
      }
    }
    if (uFaces > 0.5) {
      for(int i=0;i<2;i++){
        float fi = float(i);
        vec2 fp = p - 1.1*vec2( noise(vec2(t*0.03, fi*9.1))*1.6,
                                noise(vec2(fi*4.7, t*0.025))*1.2 );
        float vis = smoothstep(0.30, 0.80, noise(vec2(fi*23.1, t*0.055))*0.5+0.5);
        eCol += drawFace(fp, 0.55, t, fi*1.7) * vis * 0.8;
      }
    }
    if (uJester > 0.5) {
      float jvis = smoothstep(0.55, 0.85, noise(vec2(t*0.030, 41.3))*0.5+0.5);
      vec2 jp = p - vec2(0.45*sin(t*0.07), 0.25*sin(t*0.05+2.0));
      jp.y += 0.06*abs(sin(t*1.2))*jvis;
      float tilt = 0.12*sin(t*0.5);
      jp = rot2(jp, tilt);
      eCol += drawJester(jp, 0.85, t) * jvis;
    }
    eCol *= (0.55 + 0.45*coh);
    eCol *= 0.8 + 0.2*sin(sig*9.0 + t);
    col += eCol * uEntity;
  }
  if (uMandala > 0.001) {
    /* inhabit the surface rather than floating as a defined disc at the centre:
       gate by texture energy + midtone luminance and wear the scene's own local
       colour, so the chrysanthemum fluoresces out of the image and reads as one
       thing with it instead of a pasted overlay */
    vec3 mnd = mandala(p, t) * mix(vec3(1.0), chroma, 0.55);
    float mmask = uMandala * mix(0.25, 1.0, texEnergy)
                * (0.35 + 0.65 * smoothstep(0.2, 0.7, l));
    col += mnd * mmask;
  }

  fragColor = vec4(col, 1.0);
}
