/** WebGL2 context init, extension checks, canvas resize. */

export interface GLContext {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** true when EXT_color_buffer_float is available (R16F melt accumulator etc.) */
  floatFBO: boolean;
  /** current internal-resolution multiplier (adaptive perf, 0.5..1) */
  renderScale: number;
  /** change the render-scale and re-size the targets (clamped 0.5..1) */
  setRenderScale(s: number): void;
  onResize(cb: (w: number, h: number) => void): void;
}

const MAX_DPR = 1.6; // matches phenomenon.html perf choice

export function createContext(canvas: HTMLCanvasElement): GLContext {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    preserveDrawingBuffer: false,
    alpha: false,
    powerPreference: 'high-performance',
  });
  if (!gl) {
    document.body.innerHTML =
      '<p style="color:#888;padding:40px;font-family:monospace">WebGL2 is unavailable in this browser.</p>';
    throw new Error('WebGL2 unavailable');
  }

  const floatFBO = !!gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');

  // start lower on phones/tablets (coarse pointer); the adaptive loop recovers
  // toward 1.0 if the device holds framerate.
  let renderScale = matchMedia('(pointer:coarse)').matches ? 0.72 : 1;
  const resizeCbs: Array<(w: number, h: number) => void> = [];

  const ctx: GLContext = {
    gl,
    canvas,
    width: 0,
    height: 0,
    floatFBO,
    get renderScale() {
      return renderScale;
    },
    setRenderScale(s: number) {
      const clamped = Math.max(0.5, Math.min(1, s));
      if (Math.abs(clamped - renderScale) < 0.001) return;
      renderScale = clamped;
      resize();
    },
    onResize(cb) {
      resizeCbs.push(cb);
    },
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.floor(canvas.clientWidth * dpr * renderScale);
    const h = Math.floor(canvas.clientHeight * dpr * renderScale);
    if (w === ctx.width && h === ctx.height) return;
    ctx.width = canvas.width = w;
    ctx.height = canvas.height = h;
    for (const cb of resizeCbs) cb(w, h);
  }

  window.addEventListener('resize', resize);
  // clientWidth is 0 until layout; defer first sizing to caller via forceResize
  (ctx as GLContext & { forceResize?: () => void }).forceResize = resize;
  resize();
  return ctx;
}

export function forceResize(ctx: GLContext): void {
  (ctx as GLContext & { forceResize?: () => void }).forceResize?.();
}
