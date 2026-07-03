/** Control panel composition + DPH gate dialog + warnings. */

import type { Profile } from '../engine/resolver';
import { createPicker } from './picker';
import { createTierSlider } from './slider';
import { createToggles, ToggleActions } from './toggles';

const SAMPLES = [
  '01-room-lamp', '02-brick-wall', '03-forest',
  '04-street-night', '05-statue', '06-sky',
];

const ABOUT =
  'A perception-simulation art/education tool: it renders a photo as if the ' +
  'camera itself were the altered observer. All processing happens in your ' +
  'browser — images never leave the device. Intensity is expressed in ' +
  'phenomenology-literature tiers, never doses. Nothing here is guidance of any kind.';

const GATE_KEY = 'dosed-lens-deliriant-ack';

export interface PanelCallbacks extends ToggleActions {
  onSubstance(id: string): void;
  onIntensity(v: number): void;
  onSample(url: string): void;
  onUpload(file: File): void;
}

export interface Panel {
  setSubstance(p: Profile): void;
  setIntensity(v: number): void;
  setPaused(p: boolean): void;
  setActiveSample(name: string | null): void;
}

export function createPanel(
  root: HTMLElement,
  profiles: Map<string, Profile>,
  cb: PanelCallbacks,
): Panel {
  root.innerHTML = `
    <div id="panel">
      <div class="hd"><h1>Dosed Lens</h1><div class="lv" id="lv"></div></div>
      <div class="sub">${ABOUT}</div>
      <div class="sec">substance</div>
      <div id="picker"></div>
      <div class="sec">intensity</div>
      <div id="slider"></div>
      <div class="note" id="note"></div>
      <div class="sec">image</div>
      <div class="samples" id="samples"></div>
      <div class="row">
        <label class="btn">load image<input type="file" accept="image/*" id="file"></label>
      </div>
      <div id="actions"></div>
      <div class="hint"><kbd>H</kbd> panel · <kbd>space</kbd> pause · <kbd>1–5</kbd> tiers · drop an image anywhere</div>
    </div>
    <div id="tap">press H for controls</div>
    <div id="fps"></div>
    <div id="gate">
      <div class="box">
        <h2>Deliriant profile</h2>
        <p id="gate-text"></p>
        <div class="row">
          <button id="gate-no">back</button>
          <button id="gate-yes">show it anyway</button>
        </div>
      </div>
    </div>`;

  const panel = root.querySelector<HTMLElement>('#panel')!;
  const note = root.querySelector<HTMLElement>('#note')!;
  const lv = root.querySelector<HTMLElement>('#lv')!;
  const gate = root.querySelector<HTMLElement>('#gate')!;

  // gate flow: intercept deliriant picks until acknowledged once
  let pendingGateId: string | null = null;
  const gated = (p: Profile) =>
    p.class === 'deliriant' && !localStorage.getItem(GATE_KEY);

  const picker = createPicker(root.querySelector('#picker')!, profiles, (id) => {
    const p = profiles.get(id)!;
    if (gated(p)) {
      pendingGateId = id;
      root.querySelector('#gate-text')!.textContent = p.warning;
      gate.classList.add('show');
      return;
    }
    cb.onSubstance(id);
  });
  root.querySelector('#gate-yes')!.addEventListener('click', () => {
    localStorage.setItem(GATE_KEY, '1');
    gate.classList.remove('show');
    if (pendingGateId) cb.onSubstance(pendingGateId);
  });
  root.querySelector('#gate-no')!.addEventListener('click', () => {
    pendingGateId = null;
    gate.classList.remove('show');
  });

  const slider = createTierSlider(root.querySelector('#slider')!, cb.onIntensity);
  const toggles = createToggles(root.querySelector('#actions')!, cb);

  // samples
  const samplesEl = root.querySelector<HTMLElement>('#samples')!;
  const sampleImgs = new Map<string, HTMLImageElement>();
  for (const name of SAMPLES) {
    const img = document.createElement('img');
    img.src = `/samples/${name}.png`;
    img.title = name.slice(3).replace(/-/g, ' ');
    img.addEventListener('click', () => cb.onSample(img.src));
    sampleImgs.set(name, img);
    samplesEl.appendChild(img);
  }

  root.querySelector<HTMLInputElement>('#file')!.addEventListener('change', (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) cb.onUpload(f);
  });
  // drag & drop anywhere
  addEventListener('dragover', (e) => e.preventDefault());
  addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f && f.type.startsWith('image/')) cb.onUpload(f);
  });

  // panel visibility
  const tap = root.querySelector<HTMLElement>('#tap')!;
  addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') {
      const hidden = panel.classList.toggle('hidden');
      tap.classList.toggle('show', hidden);
    }
  });

  return {
    setSubstance(p) {
      picker.setActive(p.id);
      lv.textContent = p.name.toUpperCase();
      if (p.warning && p.class !== 'deliriant') {
        note.textContent = '⚠ ' + p.warning;
        note.classList.add('show');
      } else if (p.class === 'deliriant') {
        note.textContent = '⚠ Unsettling by design. Mouse proximity disperses what gathers.';
        note.classList.add('show');
      } else {
        note.classList.remove('show');
      }
    },
    setIntensity: (v) => slider.set(v),
    setPaused: (p) => toggles.setPaused(p),
    setActiveSample(name) {
      for (const [n, img] of sampleImgs) img.classList.toggle('on', n === name);
    },
  };
}

export function setFPS(text: string): void {
  const el = document.getElementById('fps');
  if (el) el.textContent = text;
}
