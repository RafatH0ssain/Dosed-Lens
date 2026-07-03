/** Framebuffer targets + ping-pong pair management. */

export interface Target {
  tex: WebGLTexture;
  fb: WebGLFramebuffer;
  w: number;
  h: number;
}

export type PixelFormat = 'rgba8' | 'rgba16f' | 'r16f';

function formats(gl: WebGL2RenderingContext, f: PixelFormat) {
  switch (f) {
    case 'rgba16f': return { internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT };
    case 'r16f':    return { internal: gl.R16F,    format: gl.RED,  type: gl.HALF_FLOAT };
    default:        return { internal: gl.RGBA8,   format: gl.RGBA, type: gl.UNSIGNED_BYTE };
  }
}

export function createTarget(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  opts: { format?: PixelFormat; mipmaps?: boolean; filter?: number } = {},
): Target {
  const { internal, format, type } = formats(gl, opts.format ?? 'rgba8');
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (opts.mipmaps) {
    gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(w, h))) + 1, internal, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.filter ?? gl.LINEAR);
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, opts.filter ?? gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, w, h };
}

export function destroyTarget(gl: WebGL2RenderingContext, t: Target): void {
  gl.deleteTexture(t.tex);
  gl.deleteFramebuffer(t.fb);
}

/** Two targets that swap roles each write. */
export class PingPong {
  a: Target;
  b: Target;
  private flip = false;

  constructor(
    private gl: WebGL2RenderingContext,
    w: number,
    h: number,
    private format: PixelFormat = 'rgba8',
  ) {
    this.a = createTarget(gl, w, h, { format });
    this.b = createTarget(gl, w, h, { format });
  }

  /** Target to render into next. */
  get write(): Target { return this.flip ? this.b : this.a; }
  /** Target holding the latest completed content. */
  get read(): Target { return this.flip ? this.a : this.b; }

  swap(): void { this.flip = !this.flip; }

  resize(w: number, h: number): void {
    if (this.a.w === w && this.a.h === h) return;
    destroyTarget(this.gl, this.a);
    destroyTarget(this.gl, this.b);
    this.a = createTarget(this.gl, w, h, { format: this.format });
    this.b = createTarget(this.gl, w, h, { format: this.format });
    this.flip = false;
  }

  destroy(): void {
    destroyTarget(this.gl, this.a);
    destroyTarget(this.gl, this.b);
  }
}
