/**
 * Shared CPU particle layer (≤200 instanced quads), drawn into the pipeline
 * just before P8 so post-processing sits on top.
 *
 * Consumers:
 *   meth — peripheral shadow-blob events that flee the mouse; rare humanoid
 *          silhouettes at frame edge (Heavy)
 *   DPH  — skitter clusters (leggy dark specks in periphery/dark regions,
 *          scattering off the mouse), 2–3 smoke wisps, and a scripted
 *          "someone standing there" silhouette in the darkest corner
 *   MDMA — meth's shadow events at low weight (Heavy only)
 */

import { createProgram, ProgramBundle, uni } from '../gl/program';
import type { ImageStats } from './domcolors';

export const MAX_PARTICLES = 200;
const FLOATS = 6; // x, y, sizePx, alpha, type, seed

const TYPE_SPECK = 0;
const TYPE_SMOKE = 1;
const TYPE_SIL = 2;

export interface ParticleConfig {
  /** peripheral shadow-blob event rate weight 0..1 */
  shadow: number;
  /** humanoid silhouette weight 0..1 (meth Heavy) */
  silhouette: number;
  /** skitter cluster weight 0..1 (DPH) */
  skitter: number;
  /** smoke wisp weight 0..1 (DPH) */
  smoke: number;
  /** scripted figure event weight (DPH Heavy, ~1/60 s in darkest corner) */
  figure: number;
}

interface P {
  alive: boolean;
  type: number;
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  alpha: number;
  a: number; // rendered alpha (enveloped)
  age: number;
  ttl: number;
  seed: number;
  fleeing: boolean;
}

const VERT = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aPosSize; /* xy uv, z size px, w alpha */
layout(location=2) in vec2 aTypeSeed;
uniform vec2 uRes;
out vec2 vLuv;
flat out float vType;
flat out float vSeed;
out float vAlpha;
void main(){
  vLuv = aCorner;
  vType = aTypeSeed.x;
  vSeed = aTypeSeed.y;
  vAlpha = aPosSize.w;
  /* silhouettes are tall: stretch the quad vertically */
  vec2 ext = vec2(aPosSize.z) * (aTypeSeed.x > 1.5 ? vec2(1.0, 2.6) : vec2(1.0));
  vec2 pos = aPosSize.xy + aCorner * ext / uRes;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vLuv;
flat in float vType;
flat in float vSeed;
in float vAlpha;
uniform float uTime;
out vec4 fragColor;

float hash1(float n){ return fract(sin(n)*43758.5453123); }
vec2 hash2(vec2 p){
  p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
  return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix( mix(dot(hash2(i), f), dot(hash2(i+vec2(1,0)), f-vec2(1,0)), u.x),
              mix(dot(hash2(i+vec2(0,1)), f-vec2(0,1)), dot(hash2(i+vec2(1,1)), f-vec2(1,1)), u.x), u.y );
}

void main(){
  float d = length(vLuv);
  vec3 col = vec3(0.02, 0.02, 0.03);
  float a = 0.0;
  if (vType < 0.5) {
    /* speck: small hard-ish dark dot */
    a = smoothstep(1.0, 0.35, d);
    col = vec3(0.03, 0.03, 0.02);
  } else if (vType < 1.5) {
    /* smoke: wispy translucent gray — layered octaves + a warped, non-
       circular falloff so it billows like real smoke instead of reading
       as a soft circular sprite */
    float n = noise(vLuv * 2.4 + vSeed * 17.0 + uTime * 0.10)
            + 0.5 * noise(vLuv * 5.1 - uTime * 0.06 + vSeed * 31.0)
            + 0.28 * noise(vLuv * 1.3 + vSeed * 5.0 + uTime * 0.04);
    float dWarp = d + 0.22 * noise(vLuv * 1.6 + vSeed * 11.0);
    a = smoothstep(1.05, 0.05, dWarp) * smoothstep(-0.30, 0.60, n) * 0.34;
    col = vec3(0.42, 0.42, 0.44);
  } else {
    /* humanoid silhouette: head circle + body capsule, heavy soft edge.
       Three poses picked per-particle from vSeed: standing, hunched, crouch. */
    vec2 q = vLuv * vec2(1.0, 2.6); /* undo quad stretch → SDF space */
    float variant = mod(vSeed, 3.0);
    vec2 headOff = vec2(0.0, -1.55);
    float bodyLen = 1.15;
    float headR = 0.55;
    if (variant >= 1.0 && variant < 2.0) {
      /* hunched forward */
      headOff = vec2(0.30, -1.32);
      bodyLen = 0.95;
    } else if (variant >= 2.0) {
      /* low crouch */
      headOff = vec2(0.0, -1.05);
      bodyLen = 0.62;
      headR = 0.50;
    }
    float head = length((q - headOff) * vec2(1.6, 1.6)) - headR;
    vec2 bq = q; bq.y = max(abs(bq.y + 0.35) - bodyLen, 0.0);
    float body = length(vec2(bq.x * 1.9, bq.y)) - 0.62;
    float sdf = min(head, body);
    a = smoothstep(0.30, -0.15, sdf) * 0.8;
    col = vec3(0.015, 0.015, 0.02);
  }
  fragColor = vec4(col, a * vAlpha);
}`;

export class ParticleLayer {
  private pool: P[] = [];
  private data = new Float32Array(MAX_PARTICLES * FLOATS);
  private prog: ProgramBundle;
  private vao: WebGLVertexArrayObject;
  private instBuf: WebGLBuffer;
  private count = 0;
  private figureTimer = 30; // first DPH figure event no sooner than ~30 s in
  private stats: ImageStats | null = null;

  constructor(private gl: WebGL2RenderingContext) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push({
        alive: false, type: 0, x: 0, y: 0, vx: 0, vy: 0, size: 4,
        alpha: 0, a: 0, age: 0, ttl: 1, seed: Math.random() * 100, fleeing: false,
      });
    }
    this.prog = createProgram(gl, FRAG, VERT);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const corners = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.instBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, FLOATS * 4, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, FLOATS * 4, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
  }

  setImageStats(s: ImageStats): void {
    this.stats = s;
  }

  /** luminance 0..1 at uv (y up); 0.5 when no stats yet */
  private lumAt(x: number, y: number): number {
    const s = this.stats;
    if (!s) return 0.5;
    const n = s.lumGridSize;
    const gx = Math.min(n - 1, Math.max(0, Math.floor(x * n)));
    const gy = Math.min(n - 1, Math.max(0, Math.floor((1 - y) * n)));
    return s.lumGrid[gy * n + gx];
  }

  private spawn(): P | null {
    for (const p of this.pool) {
      if (!p.alive) {
        p.alive = true;
        p.age = 0;
        p.a = 0;
        p.fleeing = false;
        p.seed = Math.random() * 100;
        return p;
      }
    }
    return null;
  }

  /** random position in the outer band of the frame */
  private peripheralPos(p: P): void {
    const side = Math.random();
    const t = Math.random();
    if (side < 0.35) { p.x = t; p.y = 0.05 + Math.random() * 0.15; }
    else if (side < 0.55) { p.x = t; p.y = 0.8 + Math.random() * 0.15; }
    else if (side < 0.8) { p.x = 0.02 + Math.random() * 0.15; p.y = t; }
    else { p.x = 0.83 + Math.random() * 0.15; p.y = t; }
  }

  /** rejection-sample a dark peripheral spot */
  private darkPos(p: P): void {
    for (let i = 0; i < 8; i++) {
      this.peripheralPos(p);
      if (this.lumAt(p.x, p.y) < 0.35) return;
    }
  }

  /** local luminance contrast at (x,y): max |Δlum| to the 8 grid neighbours —
      a cheap edge-density proxy from the analysis lumGrid */
  private contrastAt(x: number, y: number): number {
    const s = this.stats;
    if (!s) return 0;
    const n = s.lumGridSize;
    const gx = Math.min(n - 1, Math.max(0, Math.floor(x * n)));
    const gy = Math.min(n - 1, Math.max(0, Math.floor((1 - y) * n)));
    const c = s.lumGrid[gy * n + gx];
    let m = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = Math.min(n - 1, Math.max(0, gx + dx));
        const ny = Math.min(n - 1, Math.max(0, gy + dy));
        m = Math.max(m, Math.abs(s.lumGrid[ny * n + nx] - c));
      }
    }
    return m;
  }

  /** best-of-N peripheral spot that is both dark AND high-contrast, so a meth
      shadow blob emerges where the scene has a misreadable dark feature rather
      than at a random screen position (the DeepDream / pareidolia principle) */
  private darkEdgePos(p: P): void {
    let bx = p.x, by = p.y, best = -1;
    for (let i = 0; i < 10; i++) {
      this.peripheralPos(p);
      const dark = 1 - this.lumAt(p.x, p.y);
      const score = dark * (0.3 + this.contrastAt(p.x, p.y));
      if (score > best) { best = score; bx = p.x; by = p.y; }
    }
    p.x = bx; p.y = by;
  }

  update(dt: number, intensity: number, mouse: readonly [number, number], cfg: ParticleConfig): void {
    // ---- spawning ----
    if (cfg.shadow > 0.01 && Math.random() < cfg.shadow * intensity * 2.6 * dt) {
      const p = this.spawn();
      if (p) {
        p.type = TYPE_SPECK; // shadow blob = big soft speck
        this.darkEdgePos(p); // emerge from a dark, misreadable scene feature
        p.size = 30 + Math.random() * 50;
        p.alpha = 0.5;
        p.ttl = 0.2 + Math.random() * 0.2;
        const a = Math.random() * Math.PI * 2;
        const v = 0.10 + Math.random() * 0.12;
        p.vx = Math.cos(a) * v;
        p.vy = Math.sin(a) * v;
      }
    }
    // rare humanoid silhouettes, p ≈ 0.032/s at full weight
    if (cfg.silhouette > 0.01 && Math.random() < 0.032 * cfg.silhouette * dt) {
      const p = this.spawn();
      if (p) {
        p.type = TYPE_SIL;
        // appear against whichever side edge is darker
        const yy = 0.25 + Math.random() * 0.2;
        const leftX = 0.04 + Math.random() * 0.08;
        const rightX = 0.88 + Math.random() * 0.08;
        const useLeft = this.lumAt(leftX, yy) <= this.lumAt(rightX, yy);
        p.x = useLeft ? leftX : rightX;
        p.y = yy;
        p.size = 40 + Math.random() * 25;
        p.alpha = 0.55;
        p.ttl = 0.3;
        p.vx = 0; p.vy = 0;
      }
    }
    if (cfg.skitter > 0.01 && Math.random() < cfg.skitter * intensity * 1.4 * dt) {
      // a cluster of 8–20 leggy specks
      const n = 8 + Math.floor(Math.random() * 13);
      const anchor = this.spawn();
      if (anchor) {
        anchor.type = TYPE_SPECK;
        this.darkPos(anchor);
        anchor.size = 2.5;
        anchor.alpha = 0.8;
        anchor.ttl = 3 + Math.random() * 4;
        anchor.vx = anchor.vy = 0;
        for (let i = 1; i < n; i++) {
          const p = this.spawn();
          if (!p) break;
          p.type = TYPE_SPECK;
          p.x = anchor.x + (Math.random() - 0.5) * 0.06;
          p.y = anchor.y + (Math.random() - 0.5) * 0.06;
          p.size = 1.5 + Math.random() * 2.5;
          p.alpha = 0.6 + Math.random() * 0.3;
          p.ttl = anchor.ttl * (0.7 + Math.random() * 0.5);
          p.vx = p.vy = 0;
        }
      }
    }
    if (cfg.smoke > 0.01) {
      let smokeCount = 0;
      for (const p of this.pool) if (p.alive && p.type === TYPE_SMOKE) smokeCount++;
      // 0 at the smoke-wake threshold -> 1 near max weight: widens coverage,
      // count, and size toward Heavy instead of a fixed small upper band
      const heavyT = Math.min(1, cfg.smoke / 0.6);
      const cap = 30 + Math.round(20 * heavyT);
      if (smokeCount < cap && Math.random() < cfg.smoke * (1.2 + 1.4 * heavyT) * dt) {
        const p = this.spawn();
        if (p) {
          p.type = TYPE_SMOKE;
          p.x = (0.15 - 0.13 * heavyT) + Math.random() * (0.7 + 0.30 * heavyT);
          p.y = (0.05 - 0.03 * heavyT) + Math.random() * (0.35 + 0.40 * heavyT);
          p.size = (60 + 50 * heavyT) + Math.random() * (80 + 70 * heavyT);
          p.alpha = 0.5 + 0.20 * heavyT;
          p.ttl = 9 + Math.random() * (6 + 5 * heavyT);
          p.vx = (Math.random() - 0.5) * 0.008;
          p.vy = 0.005 + Math.random() * 0.007;
        }
      }
    }
    if (cfg.figure > 0.01) {
      this.figureTimer -= dt;
      if (this.figureTimer <= 0) {
        this.figureTimer = 45 + Math.random() * 30; // ~1 per minute
        const p = this.spawn();
        if (p) {
          p.type = TYPE_SIL;
          // darkest corner region
          const corners: Array<[number, number]> = [[0.08, 0.25], [0.92, 0.25], [0.08, 0.6], [0.92, 0.6]];
          let best = corners[0];
          let bl = 10;
          for (const c of corners) {
            const l = this.lumAt(c[0], c[1]);
            if (l < bl) { bl = l; best = c; }
          }
          p.x = best[0]; p.y = best[1];
          p.size = 55;
          p.alpha = 0.7 * cfg.figure;
          p.ttl = 0.5;
          p.vx = p.vy = 0;
        }
      }
    } else {
      this.figureTimer = Math.max(this.figureTimer, 20);
    }

    // ---- simulate + pack ----
    let n = 0;
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.age += dt;
      const mdx = p.x - mouse[0];
      const mdy = p.y - mouse[1];
      const md = Math.hypot(mdx, mdy);

      if (p.type === TYPE_SPECK) {
        if (p.size > 10) {
          // shadow blob: dies instantly when the gaze approaches
          if (md < 0.22) p.age = Math.max(p.age, p.ttl * 0.85);
        } else {
          // skitter: leggy jitter walk + scatter off the mouse
          if (md < 0.12 && md > 1e-4) {
            p.vx += (mdx / md) * 1.4 * dt;
            p.vy += (mdy / md) * 1.4 * dt;
            p.age = Math.max(p.age, p.ttl - 0.8); // and fade soon
          }
          if (Math.random() < 7 * dt) {
            // new leg thrust
            const a = Math.random() * Math.PI * 2;
            const v = 0.02 + Math.random() * 0.10;
            p.vx = Math.cos(a) * v;
            p.vy = Math.sin(a) * v * 0.6;
          }
          p.vx *= Math.exp(-6 * dt);
          p.vy *= Math.exp(-6 * dt);
        }
      } else if (p.type === TYPE_SMOKE) {
        // gentle wafting curl instead of a straight-line drift, so wisps
        // billow/curl rather than sliding across the frame like a sprite
        const curl = Math.sin(p.age * 0.22 + p.seed) * 0.0055;
        p.vx += curl * dt;
        p.vx *= Math.exp(-0.6 * dt);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // envelope: quick in, ease out
      const t01 = p.age / p.ttl;
      const env = Math.min(1, p.age * 8) * Math.max(0, 1 - Math.pow(Math.max(t01 * 1.05 - 0.05, 0), 2));
      p.a = p.alpha * Math.max(0, env);
      if (p.age >= p.ttl || p.x < -0.05 || p.x > 1.05 || p.y < -0.05 || p.y > 1.05) {
        p.alive = false;
        continue;
      }
      const o = n * FLOATS;
      this.data[o] = p.x;
      this.data[o + 1] = p.y;
      this.data[o + 2] = p.size;
      this.data[o + 3] = p.a;
      this.data[o + 4] = p.type;
      this.data[o + 5] = p.seed;
      n++;
      if (n >= MAX_PARTICLES) break;
    }
    this.count = n;
  }

  get active(): boolean {
    return this.count > 0;
  }

  /** draw into the currently bound framebuffer (called by graph before P8) */
  draw(w: number, h: number, time: number): void {
    if (this.count === 0) return;
    const gl = this.gl;
    gl.useProgram(this.prog.prog);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * FLOATS);
    gl.uniform2f(uni(gl, this.prog, 'uRes'), w, h);
    gl.uniform1f(uni(gl, this.prog, 'uTime'), time);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }
}
