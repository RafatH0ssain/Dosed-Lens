/**
 * Per-effect override drawer (M7). Lists the active profile's live shared
 * params, each with a 0–2× multiplier over the authored `max`. Values feed
 * `resolver.overrides[name]` (consumed in Resolver.resolve). Collapsible;
 * a reset returns every param to 1× (as authored).
 */

import type { Profile } from '../engine/resolver';

export interface OverrideCallbacks {
  /** mult === 1 means "as authored"; called on every slider input */
  onOverride(name: string, mult: number): void;
}

export interface OverrideDrawer {
  /** Rebuild rows for a profile; `initial` seeds non-default multipliers. */
  rebuild(p: Profile, initial?: Record<string, number>): void;
  /** Reflect a value set elsewhere (e.g. the twin drawer) without firing back. */
  setValue(name: string, mult: number): void;
}

export function createOverrides(
  root: HTMLElement,
  cb: OverrideCallbacks,
): OverrideDrawer {
  root.innerHTML = `
    <button class="ov-head" aria-expanded="false">
      <span>per-effect overrides</span><span class="ov-caret">▸</span>
    </button>
    <div class="ov-body">
      <div class="ov-rows"></div>
      <div class="row"><button class="ov-reset">reset all</button></div>
    </div>`;

  const head = root.querySelector<HTMLButtonElement>('.ov-head')!;
  const body = root.querySelector<HTMLElement>('.ov-body')!;
  const rowsEl = root.querySelector<HTMLElement>('.ov-rows')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('.ov-reset')!;

  let open = false;
  const setOpen = (v: boolean) => {
    open = v;
    root.classList.toggle('open', open);
    head.setAttribute('aria-expanded', String(open));
    head.querySelector('.ov-caret')!.textContent = open ? '▾' : '▸';
  };
  head.addEventListener('click', () => setOpen(!open));

  // one input per param, rebuilt on substance switch
  let inputs: { name: string; input: HTMLInputElement; out: HTMLElement }[] = [];

  const fmt = (m: number) => `${m.toFixed(2)}×`;

  function rebuild(p: Profile, initial?: Record<string, number>): void {
    rowsEl.innerHTML = '';
    inputs = [];
    // only params that actually do something for this substance
    const names = Object.entries(p.shared)
      .filter(([, spec]) => spec.curve !== 'none' && spec.max > 0)
      .map(([name]) => name);

    if (names.length === 0) {
      rowsEl.innerHTML = '<div class="ov-empty">no adjustable effects</div>';
      return;
    }

    for (const name of names) {
      const mult = initial?.[name] ?? 1;
      const row = document.createElement('div');
      row.className = 'ov-row';
      row.innerHTML = `
        <label>${name}<output>${fmt(mult)}</output></label>
        <input type="range" min="0" max="2" step="0.05" value="${mult}">`;
      const input = row.querySelector('input')!;
      const out = row.querySelector('output')!;
      input.addEventListener('input', () => {
        const m = +input.value;
        out.textContent = fmt(m);
        cb.onOverride(name, m);
      });
      rowsEl.appendChild(row);
      inputs.push({ name, input, out });
      // apply seeded value into the resolver immediately
      if (mult !== 1) cb.onOverride(name, mult);
    }
  }

  resetBtn.addEventListener('click', () => {
    for (const { name, input, out } of inputs) {
      input.value = '1';
      out.textContent = fmt(1);
      cb.onOverride(name, 1);
    }
  });

  // reflect an external change (the twin drawer) without echoing the callback
  function setValue(name: string, mult: number): void {
    const row = inputs.find((r) => r.name === name);
    if (!row) return;
    row.input.value = String(mult);
    row.out.textContent = fmt(mult);
  }

  // keep collapsed by default (advanced feature)
  setOpen(false);
  void body; // referenced via CSS .open

  return { rebuild, setValue };
}
