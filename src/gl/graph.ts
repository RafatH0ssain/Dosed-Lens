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

  private srcTex: WebGLTexture | null = null;
  private imgW = 1;
  private imgH = 1;
  private analysisDirty = true;
  private fit = new Float32Array([1, 1, 0, 0]);
  seedColors = new Float32Array(16); // 4 × RGBA, set by setImage caller

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
    private analysisBody: string,
    private common: string,
  ) {
    const gl = (this.gl = ctx.gl);
    this.quad = createQuad(gl);
    this.scenePing = new PingPong(gl, ctx.width, ctx.height);
    this.prevPing = new PingPong(gl, ctx.width, ctx.height);
    this.edgesT = createTarget(gl, ctx.width, ctx.height);
    this.lumT = createTarget(gl, ctx.width, ctx.height, { mipmaps: true });
    this.analysis = createProgram(gl, buildFragmentSource(analysisBody, { common }));
    this.present = createProgram(gl, buildFragmentSource(PRESENT_FRAG, { common }));
    this.rebuildPasses();

    ctx.onResize((w, h) => {
      this.scenePing.resize(w, h);
      this.prevPing.resize(w, h);
      destroyTarget(gl, this.edgesT);
      destroyTarget(gl, this.lumT);
      this.edgesT = createTarget(gl, w, h);
      this.lumT = createTarget(gl, w, h, { mipmaps: true });
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

  private computeFit(): void {
    const { width: rw, height: rh } = this.ctx;
    const s = Math.max(rw / this.imgW, rh / this.imgH);
    const sx = rw / (this.imgW * s);
    const sy = rh / (this.imgH * s);
    this.fit[0] = sx;
    this.fit[1] = sy;
    this.fit[2] = 0.5 * (1 - sx);
    this.fit[3] = 0.5 * (1 - sy);
  }

  private bindCommon(b: ProgramBundle, f: FrameState, sceneTex: WebGLTexture): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(uni(gl, b, 'uScene'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
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

    gl.uniform2f(uni(gl, b, 'uRes'), this.ctx.width, this.ctx.height);
    gl.uniform1f(uni(gl, b, 'uAspect'), this.ctx.width / this.ctx.height);
    gl.uniform1f(uni(gl, b, 'uTime'), f.time);
    gl.uniform1f(uni(gl, b, 'uDt'), f.dt);
    gl.uniform1f(uni(gl, b, 'uIntensity'), f.intensity);
    gl.uniform1fv(uni(gl, b, 'uTier'), f.tier);
    gl.uniform2f(uni(gl, b, 'uMouse'), f.mouse[0], f.mouse[1]);
    gl.uniform4fv(uni(gl, b, 'uFit'), this.fit);
    gl.uniform4fv(uni(gl, b, 'uSeedCol'), this.seedColors);

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
    this.bindCommon(this.analysis, f, this.srcTex!);
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
  }

  private skip(def: PassSource, f: FrameState): boolean {
    if (!def.gates) return false;
    for (const g of def.gates) {
      if ((f.shared[g] ?? 0) > GATE_EPS) return false;
    }
    return true;
  }

  render(f: FrameState): void {
    if (!this.srcTex) return;
    const gl = this.gl;
    gl.bindVertexArray(this.quad);
    this.computeFit();
    if (this.analysisDirty) this.runAnalysis(f);

    const active = this.activeScratch;
    active.length = 0;
    for (const p of this.passes) if (!this.skip(p.def, f)) active.push(p);
    let cur = this.srcTex;
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const last = i === active.length - 1;
      const target = last ? this.prevPing.write : this.scenePing.write;
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
      gl.viewport(0, 0, target.w, target.h);
      gl.useProgram(p.bundle.prog);
      this.bindCommon(p.bundle, f, cur);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      cur = target.tex;
      if (!last) this.scenePing.swap();
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
