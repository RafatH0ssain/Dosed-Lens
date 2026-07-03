/** Draggable before/after split divider (full version in M7).
    The present pass renders the original left of `split`. */

export function createCompare(canvas: HTMLCanvasElement, get: () => number, set: (v: number) => void): void {
  let dragging = false;
  canvas.addEventListener('pointerdown', (e) => {
    const s = get();
    if (s <= 0) return;
    const x = e.clientX / window.innerWidth;
    if (Math.abs(x - s) < 0.03) {
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    set(Math.min(0.98, Math.max(0.02, e.clientX / window.innerWidth)));
  });
  canvas.addEventListener('pointerup', () => (dragging = false));
}
