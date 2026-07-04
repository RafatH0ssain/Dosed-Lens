/**
 * Shader compile/link with runtime include tokens and a uniform cache.
 *
 * File-level includes are handled by vite-plugin-glsl at build time; the two
 * runtime tokens below exist because their content changes per substance:
 *   //__SIGNATURE__  → replaced with the active substance's signature module
 *   //__SIGPARAMS__  → replaced with `uniform float uSig_<name>;` declarations
 */

const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }
`;

export interface ProgramBundle {
  prog: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

export function buildFragmentSource(
  fragBody: string,
  opts: { common?: string; signature?: string; sigParamNames?: string[] } = {},
): string {
  const sigDecls = (opts.sigParamNames ?? [])
    .map((n) => `uniform float uSig_${n};`)
    .join('\n');
  let body = fragBody;
  if (body.includes('//__SIGNATURE__')) {
    body = body.replace('//__SIGNATURE__', opts.signature ?? '');
  }
  return [
    '#version 300 es',
    'precision highp float;',
    opts.common ?? '',
    sigDecls,
    body,
  ].join('\n');
}

export function createProgram(
  gl: WebGL2RenderingContext,
  fragSrc: string,
  vertSrc: string = VERT,
): ProgramBundle {
  const vs = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`Program link failed: ${log}`);
  }
  return { prog, uniforms: new Map() };
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const numbered = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
    gl.deleteShader(s);
    throw new Error(`Shader compile failed:\n${log}\n---\n${numbered}`);
  }
  return s;
}

export function uni(
  gl: WebGL2RenderingContext,
  b: ProgramBundle,
  name: string,
): WebGLUniformLocation | null {
  let loc = b.uniforms.get(name);
  if (loc === undefined) {
    loc = gl.getUniformLocation(b.prog, name);
    b.uniforms.set(name, loc);
  }
  return loc;
}

/** Fullscreen-triangle VAO shared by every pass. */
export function createQuad(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return vao;
}
