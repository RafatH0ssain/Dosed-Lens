/** Control panel composition + DPH gate dialog + warnings. */

import type { Profile } from '../engine/resolver';
import { createPicker } from './picker';
import { createTierSlider } from './slider';
import { createToggles, ToggleActions } from './toggles';
import { createOverrides, OverrideCallbacks } from './overrides';

const SAMPLES = [
  '01-room-lamp', '02-brick-wall', '03-forest', '05-statue', '06-sky',
];

const ABOUT =
  'A perception-simulation art/education tool: it renders a photo as if the ' +
  'camera itself were the altered observer. All processing happens in your ' +
  'browser — images never leave the device. Intensity is expressed in ' +
  'phenomenology-literature tiers, never doses. Nothing here is guidance of any kind.';

const GATE_KEY = 'dosed-lens-deliriant-ack';

export interface PanelCallbacks extends ToggleActions, OverrideCallbacks {
  onSubstance(id: string): void;
  onIntensity(v: number): void;
  onSample(url: string): void;
  onUpload(file: File): void;
  /** toggle the webcam as the live source; returns nothing — panel reflects
      the result via setWebcam / setWebcamError */
  onWebcam(): void;
  onMirror(on: boolean): void;
  onFlip(): void;
}

export interface Panel {
  setSubstance(p: Profile, initialOverrides?: Record<string, number>): void;
  setIntensity(v: number): void;
  setPaused(p: boolean): void;
  setActiveSample(name: string | null): void;
  /** Reflect webcam on/off state (button highlight + mirror row visibility). */
  setWebcam(on: boolean): void;
  /** Show/hide the flip-camera control (only when >1 camera exists). */
  setFlipAvailable(available: boolean): void;
  /** Reflect the mirror checkbox state (front cam on, back cam off). */
  setMirror(on: boolean): void;
  /** Show a camera error message, or clear it with null. */
  setWebcamError(msg: string | null): void;
  /** Select a substance through the same gate flow as clicking the picker. */
  pick(id: string): void;
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
        <button class="btn" id="webcam">webcam</button>
      </div>
      <div class="row cam-flip-row" id="flip-row"><button id="flip">flip camera</button></div>
      <label class="mirror-row" id="mirror-row"><input type="checkbox" id="mirror" checked> mirror (selfie view)</label>
      <div class="note" id="cam-err"></div>
      <div id="actions"></div>
      <div id="overrides" class="overrides"></div>
      <div class="hint"><kbd>H</kbd> panel · <kbd>space</kbd> pause · <kbd>1–5</kbd> tiers · drop an image anywhere</div>
    </div>
    <div id="tap">press H for controls</div>
    <button id="menu" aria-label="toggle controls">◧</button>
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

  // gated pick: show the confirm dialog for un-acknowledged deliriants,
  // otherwise apply immediately. Shared by the picker and boot deep-links.
  const pick = (id: string) => {
    const p = profiles.get(id)!;
    if (gated(p)) {
      pendingGateId = id;
      root.querySelector('#gate-text')!.textContent = p.warning;
      gate.classList.add('show');
      return;
    }
    cb.onSubstance(id);
  };

  const picker = createPicker(root.querySelector('#picker')!, profiles, pick);
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
  const overrides = createOverrides(root.querySelector('#overrides')!, cb);

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

  // webcam controls
  const webcamBtn = root.querySelector<HTMLButtonElement>('#webcam')!;
  const mirrorRow = root.querySelector<HTMLElement>('#mirror-row')!;
  const mirrorBox = root.querySelector<HTMLInputElement>('#mirror')!;
  const flipRow = root.querySelector<HTMLElement>('#flip-row')!;
  const camErr = root.querySelector<HTMLElement>('#cam-err')!;
  webcamBtn.addEventListener('click', () => cb.onWebcam());
  mirrorBox.addEventListener('change', () => cb.onMirror(mirrorBox.checked));
  root.querySelector<HTMLButtonElement>('#flip')!.addEventListener('click', () => cb.onFlip());
  // drag & drop anywhere
  addEventListener('dragover', (e) => e.preventDefault());
  addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f && f.type.startsWith('image/')) cb.onUpload(f);
  });

  // panel visibility — H key (desktop) or the ◧ button (always, incl. touch)
  const tap = root.querySelector<HTMLElement>('#tap')!;
  const menuBtn = root.querySelector<HTMLButtonElement>('#menu')!;
  function togglePanel(): void {
    const hidden = panel.classList.toggle('hidden');
    tap.classList.toggle('show', hidden);
    menuBtn.classList.toggle('on', !hidden);
  }
  menuBtn.classList.add('on'); // panel starts open
  menuBtn.addEventListener('click', togglePanel);
  addEventListener('keydown', (e) => {
    if ((e.key === 'h' || e.key === 'H') && !(e.target instanceof HTMLInputElement)) {
      togglePanel();
    }
  });

  return {
    setSubstance(p, initialOverrides) {
      picker.setActive(p.id);
      overrides.rebuild(p, initialOverrides);
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
    setWebcam(on) {
      webcamBtn.classList.toggle('on', on);
      webcamBtn.textContent = on ? 'stop webcam' : 'webcam';
      mirrorRow.classList.toggle('show', on);
      if (!on) flipRow.classList.remove('show');
      if (on) camErr.classList.remove('show');
    },
    setFlipAvailable(available) {
      flipRow.classList.toggle('show', available);
    },
    setMirror(on) {
      mirrorBox.checked = on;
    },
    setWebcamError(msg) {
      camErr.textContent = msg ? '⚠ ' + msg : '';
      camErr.classList.toggle('show', !!msg);
    },
    pick,
  };
}

export function setFPS(text: string): void {
  const el = document.getElementById('fps');
  if (el) el.textContent = text;
}
