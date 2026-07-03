/** WebGL2 context init, extension checks, canvas resize. */

export interface GLContext {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** true when EXT_color_buffer_float is available (R16F melt accumulator etc.) */
  floatFBO: boolean;
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

  const ctx: GLContext = {
    gl,
    canvas,
    width: 0,
    height: 0,
    floatFBO,
    onResize(cb) {
      resizeCbs.push(cb);
    },
  };

  const resizeCbs: Array<(w: number, h: number) => void> = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
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
