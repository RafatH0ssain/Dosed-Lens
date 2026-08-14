/**
 * Fixed-order pass scheduler.
 *
 * Per frame:  src → P2 geometry → P3 pattern → P4 color → P5 temporal
 *                 → P6 acuity → P7 grain → P8 post → present
 * P1 (analysis) runs only when the image or resolution changes; its outputs
 * (uEdges, uLum pyramid) are cached and bound to every downstream pass.
 * Gated passes (weight 0 across all their shared params) are skipped.
 * P2/P4/P5 embed the active substance's signature module and recompile on
 * substance switch.
 */

import type { GLContext } from './context';
import { PingPong, Target, createTarget, destroyTarget } from './fbo';
import {
  ProgramBundle,
  buildFragmentSource,
  createProgram,
  createQuad,
  uni,
} from './program';

export type PassName =
  | 'geometry' | 'pattern' | 'color' | 'temporal' | 'acuity' | 'grain' | 'post';

export interface PassSource {
  name: PassName;
  body: string;
  /** embeds the signature module → recompiles on substance switch */
  signature: boolean;
  /** shared-param names that enable this pass; null = always runs */
  gates: string[] | null;
}

export interface PatternDrive {
  entity: number;
  eyes: number;
  faces: number;
  jester: number;
  mandala: number;
  breakthrough: number;
  boost: number;
}

export interface FrameState {
  time: number;
  dt: number;
  intensity: number;
  tier: Float32Array; // 5 triangular weights
  shared: Record<string, number>;
  sig: Record<string, number>;
  mouse: readonly [number, number];
  /** 0 = off, else x position of before/after split (0..1) */
  split: number;
  /** melt accumulator weight; > 0 runs the flow pass (psilocybin) */
  flow: number;
  /** truthy keeps the quarter-res history ring recording (nitrous) */
  hist: number;
  /** per-frame drive of P3's entity/mandala/breakthrough layer (DMT) */
  pattern: PatternDrive;
}

const GATE_EPS = 0.004;

const PRESENT_FRAG = `
uniform float uSplit;
void main(){
  vec3 col = texture(uScene, vUv).rgb;
  if (uSplit > 0.0) {
    if (vUv.x < uSplit) col = texture(uSrc, fitUV(vUv)).rgb;
    float d = abs(vUv.x - uSplit) * uRes.x;
    col = mix(vec3(0.85), col, smoothstep(0.5, 1.5, d));
  }
  fragColor = vec4(col, 1.0);
}`;

// Live-input conditioning: unsharp for local contrast (revives edges the
// distortions ride on), auto-levels contrast stretch, then a saturation lift.
// Applied to the raw webcam frame before P1 so the whole pipeline benefits.
const CONDITION_FRAG = `
uniform vec2 uCondLevels;  /* black, white luma points */
uniform float uCondSat;
uniform float uCondDetail;
void main(){
  vec3 c = texture(uScene, vUv).rgb;
  vec2 px = 1.4 / uRes;
  vec3 blur = (texture(uScene, vUv + vec2(px.x, px.y)).rgb
             + texture(uScene, vUv + vec2(-px.x, px.y)).rgb
             + texture(uScene, vUv + vec2(px.x, -px.y)).rgb
             + texture(uScene, vUv + vec2(-px.x, -px.y)).rgb) * 0.25;
  c += (c - blur) * uCondDetail;                 /* local contrast → edges */
  float l = max(luma(c), 1e-4);
  float ln = clamp((l - uCondLevels.x) / max(uCondLevels.y - uCondLevels.x, 0.05), 0.0, 1.0);
  ln = ln * ln * (3.0 - 2.0 * ln);               /* gentle S-curve */
  c *= ln / l;                                   /* rescale luminance, keep hue */
  float l2 = luma(c);
  c = mix(vec3(l2), c, uCondSat);                /* saturation lift */
  fragColor = vec4(clamp(c, 0.0, 1.6), 1.0);
}`;

interface Pass {
  def: PassSource;
  bundle: ProgramBundle;
}

export class Graph {
  private gl: WebGL2RenderingContext;
  private quad: WebGLVertexArrayObject;
  private passes: Pass[] = [];
  private present!: ProgramBundle;
  private analysis!: ProgramBundle;

  private scenePing: PingPong;
  private prevPing: PingPong;
  private edgesT: Target;
  private lumT: Target;
  private flowPing: PingPong;
  private histT: Target;
  private histCopy!: ProgramBundle;
  private flowProg!: ProgramBundle;
  private histHead = 0;
  private histParity = 0;

  private srcTex: WebGLTexture | null = null;
  private imgW = 1;
  private imgH = 1;
  private analysisDirty = true;
  private fit = new Float32Array([1, 1, 0, 0]);
  /** live webcam frame source; when set, render() re-uploads srcTex each frame */
  private liveSource: HTMLVideoElement | null = null;
  private liveW = 0;
  private liveH = 0;
  /** currentTime of the last frame uploaded — skips duplicate uploads */
  private liveTime = -1;
  /** horizontal flip of the source (selfie-mirror for the webcam) */
  mirror = false;

  // input conditioning (live source only): normalises a soft/flat/muted
  // webcam frame into the crisp, saturated structure the effects need to grab.
  private condProg!: ProgramBundle;
  private condTarget: Target | null = null;
  private conditioned = false;
  private condStale = false; // a new raw frame is waiting to be conditioned
  private condLevels = new Float32Array([0.0, 1.0]); // black, white points (luma)
  condSat = 1.35; // saturation lift
  condDetail = 0.9; // local-contrast / unsharp amount
  seedColors = new Float32Array(16); // 4 × RGBA, set by setImage caller
  brightPos = new Float32Array([0.5, 0.5]); // set by setImage caller

  /** drawn into the current target just before the post pass (particles) */
  overlay: ((w: number, h: number, time: number) => void) | null = null;

  /** total P1 runs — read by the debug HUD to report the achieved refresh rate */
  analysisRuns = 0;

  // null module so passes compile before the first setSignature call
  private signatureSrc = `
vec2 sigWarp(vec2 uv){ return uv; }
vec3 sigColor(vec3 col, vec2 uv){ return col; }
vec3 sigTemporal(vec3 col, vec2 uv){ return col; }`;
  private sigParamNames: string[] = [];
  private activeScratch: Pass[] = [];

  constructor(
    private ctx: GLContext,
    private passSources: PassSource[],
    analysisBody: string,
    private common: string,
    flowBody: string,
  ) {
    const gl = (this.gl = ctx.gl);
    this.quad = createQuad(gl);
    this.scenePing = new PingPong(gl, ctx.width, ctx.height);
    this.prevPing = new PingPong(gl, ctx.width, ctx.height);
    this.edgesT = createTarget(gl, ctx.width, ctx.height);
    this.lumT = createTarget(gl, ctx.width, ctx.height, { mipmaps: true });
    // melt accumulator: fixed low-res, screen-aligned UVs
    this.flowPing = new PingPong(gl, 288, 180, ctx.floatFBO ? 'r16f' : 'rgba8');
    // history ring: 4×4 atlas of quarter-res frames
    this.histT = createTarget(gl, ctx.width, ctx.height);
    this.analysis = createProgram(gl, buildFragmentSource(analysisBody, { common }));
    this.present = createProgram(gl, buildFragmentSource(PRESENT_FRAG, { common }));
    this.flowProg = createProgram(gl, buildFragmentSource(flowBody, { common }));
    this.condProg = createProgram(gl, buildFragmentSource(CONDITION_FRAG, { common }));
    this.histCopy = createProgram(
      gl,
      buildFragmentSource('void main(){ fragColor = vec4(scene(vUv), 1.0); }', { common }),
    );
    this.rebuildPasses();

    ctx.onResize((w, h) => {
      this.scenePing.resize(w, h);
      this.prevPing.resize(w, h);
      destroyTarget(gl, this.edgesT);
      destroyTarget(gl, this.lumT);
      destroyTarget(gl, this.histT);
      this.edgesT = createTarget(gl, w, h);
      this.lumT = createTarget(gl, w, h, { mipmaps: true });
      this.histT = createTarget(gl, w, h);
      this.analysisDirty = true;
    });
  }

  /** Swap the signature module and recompile the three signature passes. */
  setSignature(source: string, paramNames: string[]): void {
    this.signatureSrc = source;
    this.sigParamNames = paramNames;
    this.rebuildPasses();
  }

  private rebuildPasses(): void {
    const gl = this.gl;
    for (const p of this.passes) gl.deleteProgram(p.bundle.prog);
    this.passes = this.passSources.map((def) => ({
      def,
      bundle: createProgram(
        gl,
        buildFragmentSource(def.body, {
          common: this.common,
          signature: def.signature ? this.signatureSrc : '',
          sigParamNames: def.signature ? this.sigParamNames : [],
        }),
      ),
    }));
  }

  setImage(source: TexImageSource, w: number, h: number): void {
    const gl = this.gl;
    if (this.srcTex) gl.deleteTexture(this.srcTex);
    this.srcTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.imgW = w;
    this.imgH = h;
    this.analysisDirty = true;
  }

  get hasImage(): boolean {
    return this.srcTex !== null;
  }

  /** Switch to a live webcam source: render() re-uploads its frame each frame. */
  setLiveSource(video: HTMLVideoElement): void {
    this.liveSource = video;
    this.liveW = 0; // force a fresh allocation on the next upload
    this.liveH = 0;
    this.liveTime = -1;
  }

  clearLiveSource(): void {
    this.liveSource = null;
    this.conditioned = false; // still images are already well-conditioned
  }

  get isLive(): boolean {
    return this.liveSource !== null;
  }

  /** The texture the pipeline processes: conditioned copy when live, else raw. */
  private get source(): WebGLTexture | null {
    return this.conditioned && this.condTarget ? this.condTarget.tex : this.srcTex;
  }

  /** Update the conditioning black/white luma points (CPU-derived, throttled). */
  setConditioning(black: number, white: number): void {
    this.condLevels[0] = black;
    this.condLevels[1] = white;
  }

  /** Request a P1 re-analysis on the next frame (throttled by the caller). */
  refreshAnalysis(): void {
    this.analysisDirty = true;
  }

  /** Upload the current webcam frame into srcTex, reusing the allocation. */
  private uploadLiveFrame(): void {
    const gl = this.gl;
    const v = this.liveSource!;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (w === 0 || v.readyState < 2) return;
    // The camera runs at 30 fps but render() ticks at the display rate, so
    // roughly every other call would re-upload a frame already in srcTex.
    // Skipping those also skips the conditioning pass (condStale stays false).
    if (v.currentTime === this.liveTime && this.liveW !== 0) return;
    this.liveTime = v.currentTime;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    if (!this.srcTex || w !== this.liveW || h !== this.liveH) {
      if (this.srcTex) gl.deleteTexture(this.srcTex);
      this.srcTex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, v);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.liveW = w;
      this.liveH = h;
      this.imgW = w;
      this.imgH = h;
      this.analysisDirty = true;
      // conditioning target tracks the source dimensions
      if (this.condTarget) destroyTarget(gl, this.condTarget);
      this.condTarget = createTarget(gl, w, h);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, v);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    this.conditioned = true;
    this.condStale = true; // this fresh frame needs conditioning before use
  }

  /** Condition the raw webcam frame (srcTex) into condTarget before analysis. */
  private runConditioning(): void {
    const gl = this.gl;
    const t = this.condTarget!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.viewport(0, 0, t.w, t.h);
    gl.useProgram(this.condProg.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex); // raw upload
    gl.uniform1i(uni(gl, this.condProg, 'uScene'), 0);
    gl.uniform2f(uni(gl, this.condProg, 'uRes'), t.w, t.h);
    gl.uniform2f(uni(gl, this.condProg, 'uCondLevels'), this.condLevels[0], this.condLevels[1]);
    gl.uniform1f(uni(gl, this.condProg, 'uCondSat'), this.condSat);
    gl.uniform1f(uni(gl, this.condProg, 'uCondDetail'), this.condDetail);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.condStale = false;
  }

  private computeFit(): void {
    const { width: rw, height: rh } = this.ctx;
    const s = Math.max(rw / this.imgW, rh / this.imgH);
    const sx = rw / (this.imgW * s);
    const sy = rh / (this.imgH * s);
    this.fit[0] = sx;
    this.fit[1] = sy;
    this.fit[2] = 0.5 * (1 - sx);
    this.fit[3] = 0.5 * (1 - sy);
    if (this.mirror) {
      // reflect the source horizontally: srcU → 1 - srcU
      this.fit[0] = -sx;
      this.fit[2] = 0.5 * (1 + sx);
    }
  }

  private bindCommon(b: ProgramBundle, f: FrameState, sceneTex: WebGLTexture | null): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(uni(gl, b, 'uScene'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.source);
    gl.uniform1i(uni(gl, b, 'uSrc'), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.edgesT.tex);
    gl.uniform1i(uni(gl, b, 'uEdges'), 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.lumT.tex);
    gl.uniform1i(uni(gl, b, 'uLum'), 3);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.prevPing.read.tex);
    gl.uniform1i(uni(gl, b, 'uPrev'), 4);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, this.flowPing.read.tex);
    gl.uniform1i(uni(gl, b, 'uFlow'), 5);
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, this.histT.tex);
    gl.uniform1i(uni(gl, b, 'uHist'), 6);

    gl.uniform2f(uni(gl, b, 'uRes'), this.ctx.width, this.ctx.height);
    gl.uniform1f(uni(gl, b, 'uAspect'), this.ctx.width / this.ctx.height);
    gl.uniform1f(uni(gl, b, 'uTime'), f.time);
    gl.uniform1f(uni(gl, b, 'uDt'), f.dt);
    gl.uniform1f(uni(gl, b, 'uIntensity'), f.intensity);
    gl.uniform1fv(uni(gl, b, 'uTier'), f.tier);
    gl.uniform2f(uni(gl, b, 'uMouse'), f.mouse[0], f.mouse[1]);
    gl.uniform4fv(uni(gl, b, 'uFit'), this.fit);
    gl.uniform4fv(uni(gl, b, 'uSeedCol'), this.seedColors);
    gl.uniform2fv(uni(gl, b, 'uBright'), this.brightPos);
    gl.uniform1f(uni(gl, b, 'uHistHead'), this.histHead);

    // P3 entity/mandala/breakthrough drive — set unconditionally every frame
    // so values can never go stale across substance switches
    const pd = f.pattern;
    const setIf = (name: string, v: number) => {
      const loc = uni(gl, b, name);
      if (loc) gl.uniform1f(loc, v);
    };
    setIf('uEntity', pd.entity);
    setIf('uEyes', pd.eyes);
    setIf('uFaces', pd.faces);
    setIf('uJester', pd.jester);
    setIf('uMandala', pd.mandala);
    setIf('uBreakthrough', pd.breakthrough);
    setIf('uPatternBoost', pd.boost);
    setIf('uFlowRate', f.flow);

    for (const k in f.shared) {
      const loc = uni(gl, b, 'uP_' + k);
      if (loc) gl.uniform1f(loc, f.shared[k]);
    }
    for (const k in f.sig) {
      const loc = uni(gl, b, 'uSig_' + k);
      if (loc) gl.uniform1f(loc, f.sig[k]);
    }
  }

  private runAnalysis(f: FrameState): void {
    const gl = this.gl;
    this.computeFit();
    // mode 0: edges (RG dir, B magnitude, A luminance)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.edgesT.fb);
    gl.viewport(0, 0, this.edgesT.w, this.edgesT.h);
    gl.useProgram(this.analysis.prog);
    this.bindCommon(this.analysis, f, this.source!);
    gl.uniform1i(uni(gl, this.analysis, 'uMode'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // mode 1: luminance → mip pyramid
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.lumT.fb);
    gl.viewport(0, 0, this.lumT.w, this.lumT.h);
    gl.uniform1i(uni(gl, this.analysis, 'uMode'), 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, this.lumT.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.analysisDirty = false;
    this.analysisRuns++;
  }

  private skip(def: PassSource, f: FrameState): boolean {
    if (!def.gates) return false;
    for (const g of def.gates) {
      if ((f.shared[g] ?? 0) > GATE_EPS) return false;
    }
    return true;
  }

  render(f: FrameState): void {
    // advance the live frame unless paused (dt 0); always do the first upload
    if (this.liveSource && (f.dt > 0 || this.liveW === 0)) this.uploadLiveFrame();
    if (!this.srcTex) return;
    const gl = this.gl;
    gl.bindVertexArray(this.quad);
    this.computeFit();
    // condition the fresh webcam frame before anything reads the source
    if (this.conditioned && this.condTarget && this.condStale) this.runConditioning();
    if (this.analysisDirty) this.runAnalysis(f);

    // melt accumulator step (reads flowPing.read via uFlow, writes .write)
    if (f.flow > 0.004) {
      const ft = this.flowPing.write;
      gl.bindFramebuffer(gl.FRAMEBUFFER, ft.fb);
      gl.viewport(0, 0, ft.w, ft.h);
      gl.useProgram(this.flowProg.prog);
      this.bindCommon(this.flowProg, f, this.source!);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.flowPing.swap();
    }

    const active = this.activeScratch;
    active.length = 0;
    for (const p of this.passes) if (!this.skip(p.def, f)) active.push(p);
    let cur = this.source;
    let curTarget: Target | null = null;
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      // particles land on top of everything except post-processing
      if (p.def.name === 'post' && this.overlay && curTarget) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, curTarget.fb);
        gl.viewport(0, 0, curTarget.w, curTarget.h);
        this.overlay(curTarget.w, curTarget.h, f.time);
        gl.bindVertexArray(this.quad); // overlay uses its own VAO
      }
      // the temporal pass writes the feedback history: uPrev is its own
      // previous output, kept pre-post so vignette/grain don't accumulate
      const isTemporal = p.def.name === 'temporal';
      const target = isTemporal ? this.prevPing.write : this.scenePing.write;
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
      gl.viewport(0, 0, target.w, target.h);
      gl.useProgram(p.bundle.prog);
      this.bindCommon(p.bundle, f, cur);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      cur = target.tex;
      curTarget = target;
      if (!isTemporal) this.scenePing.swap();
    }

    // record the temporal output into the history ring (every 2nd frame)
    if (f.hist > 0) {
      this.histParity ^= 1;
      if (this.histParity === 0) {
        this.histHead = (this.histHead + 1) % 16;
        const tw = Math.floor(this.ctx.width / 4);
        const th = Math.floor(this.ctx.height / 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.histT.fb);
        gl.viewport((this.histHead % 4) * tw, Math.floor(this.histHead / 4) * th, tw, th);
        gl.useProgram(this.histCopy.prog);
        this.bindCommon(this.histCopy, f, this.prevPing.write.tex);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }

    // present to canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.ctx.width, this.ctx.height);
    gl.useProgram(this.present.prog);
    this.bindCommon(this.present, f, cur);
    gl.uniform1f(uni(gl, this.present, 'uSplit'), f.split);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // the frame just written becomes uPrev for the next one
    this.prevPing.swap();
    gl.bindVertexArray(null);
  }
}
