/** Intensity slider with the five labeled tier stops. */

import { TIER_NAMES, TIER_STOPS, tierIndex } from '../engine/curves';

export function createTierSlider(
  root: HTMLElement,
  onChange: (v: number) => void,
): { set(v: number): void } {
  const wrap = document.createElement('div');
  wrap.className = 'ctl';
  wrap.innerHTML = `
    <label>intensity <output></output></label>
    <input type="range" min="0" max="1" step="0.005">
    <div class="tier-stops"></div>`;
  root.appendChild(wrap);

  const input = wrap.querySelector('input')!;
  const out = wrap.querySelector('output')!;
  const stopsEl = wrap.querySelector('.tier-stops')!;
  const stopSpans: HTMLSpanElement[] = [];
  TIER_NAMES.forEach((name, i) => {
    const s = document.createElement('span');
    s.textContent = name;
    s.addEventListener('click', () => {
      input.value = String(TIER_STOPS[i]);
      update();
    });
    stopSpans.push(s);
    stopsEl.appendChild(s);
  });

  function update() {
    const v = +input.value;
    const ti = tierIndex(v);
    out.textContent = TIER_NAMES[ti];
    stopSpans.forEach((s, i) => s.classList.toggle('on', i === ti));
    onChange(v);
  }
  input.addEventListener('input', update);

  return {
    set(v: number) {
      input.value = String(v);
      update();
    },
  };
}
