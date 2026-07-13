/** Debug HUD (#debug=1) — overlays live device/pipeline truth for mobile
    diagnosis: camera settings, backing-store vs CSS size, render scale, FBO
    formats, fps/frame-time, P1 refresh rate, jank. Zero cost when disabled. */

import type { GLContext } from '../gl/context';
import type { Graph } from '../gl/graph';
import type { Camera } from '../engine/camera';

export interface DebugHUD {
  /** Call once per rAF with the frame timestamp. */
  tick(now: number): void;
}

export function debugEnabled(): boolean {
  return new URLSearchParams(location.hash.slice(1)).get('debug') === '1';
}

export function createDebugHUD(ctx: GLContext, graph: Graph, camera: Camera): DebugHUD {
  const gl = ctx.gl;

  // GPU identity (mask-off is fine; we show whatever the browser exposes)
  const dbgExt = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String(
    dbgExt ? gl.getParameter(dbgExt.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
  );
  // half-float renderability is the mobile-relevant capability (iOS exposes
  // EXT_color_buffer_half_float but often not the full-float extension)
  const halfFloat = !!gl.getExtension('EXT_color_buffer_half_float');

  const el = document.createElement('pre');
  el.id = 'debug-hud';
  el.style.cssText =
    'position:fixed;left:6px;bottom:calc(6px + env(safe-area-inset-bottom));z-index:40;' +
    'margin:0;padding:6px 8px;pointer-events:none;white-space:pre;' +
    'font:9px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#9fe8a0;' +
    'background:rgba(0,0,0,.62);border-radius:6px;text-shadow:0 1px 2px #000;';
  document.body.appendChild(el);

  // main-thread long tasks (script/GC stalls the rAF delta can't attribute)
  let longTasks = 0;
  try {
    new PerformanceObserver((l) => (longTasks += l.getEntries().length)).observe({
      type: 'longtask',
      buffered: false,
    });
  } catch {
    /* longtask unsupported (Safari) — the >50ms frame counter still catches it */
  }

  let lastT = 0; // previous rAF timestamp
  let frames = 0; // frames since last HUD refresh
  let sumMs = 0; // total frame time since last refresh
  let maxMs = 0; // worst frame since last refresh
  let jank = 0; // frames >50ms since load
  let lastRefresh = 0; // last HUD DOM update
  let lastP1 = 0; // graph.analysisRuns at last refresh

  function refresh(now: number): void {
    const dt = now - lastRefresh || 1;
    const fps = (frames * 1000) / dt;
    const avg = frames ? sumMs / frames : 0;
    const p1Hz = ((graph.analysisRuns - lastP1) * 1000) / dt;
    lastP1 = graph.analysisRuns;

    const s = camera.settings;
    const cam = s
      ? `${s.width}×${s.height}@${s.frameRate?.toFixed(0) ?? '?'} ${s.facingMode ?? ''}`
      : 'off';
    const cvs = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    const eff = (cvs.width / cvs.clientWidth) || 0; // realized px per CSS px

    el.textContent =
      `cam  ${cam}\n` +
      `cvs  ${cvs.clientWidth}×${cvs.clientHeight} css → ${cvs.width}×${cvs.height} fb` +
      ` · dpr ${dpr.toFixed(2)}→${eff.toFixed(2)}\n` +
      `gpu  scale ${ctx.renderScale.toFixed(2)} · scene/prev RGBA8` +
      ` · flow ${ctx.floatFBO ? 'R16F' : 'RGBA8'} · halfFloat ${halfFloat ? 'yes' : 'NO'}\n` +
      `fps  ${fps.toFixed(1)} · ${avg.toFixed(1)}ms avg · ${maxMs.toFixed(0)}ms max\n` +
      `P1   ${p1Hz.toFixed(1)}/s · jank ${jank} (>50ms) · longtask ${longTasks}\n` +
      `${renderer}`;

    frames = 0;
    sumMs = 0;
    maxMs = 0;
    lastRefresh = now;
  }

  return {
    tick(now: number): void {
      if (lastT > 0) {
        const ms = now - lastT;
        frames++;
        sumMs += ms;
        if (ms > maxMs) maxMs = ms;
        if (ms > 50) jank++;
      }
      lastT = now;
      if (now - lastRefresh > 500) refresh(now);
    },
  };
}
