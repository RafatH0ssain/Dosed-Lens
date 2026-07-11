/** UI composition: two modes.
 *  - browse  (no webcam): the "studio" panel — pick substance/intensity/image.
 *  - camera  (webcam on): a phone-camera chrome — effect reel + shutter.
 *  Plus the DPH gate dialog and warnings. Mode = `.mode-camera` on the root. */

import type { Profile } from '../engine/resolver';
import { createPicker } from './picker';
import { createTierSlider } from './slider';
import { createToggles, ToggleActions } from './toggles';
import { createOverrides, OverrideCallbacks } from './overrides';
import { TIER_NAMES, tierIndex } from '../engine/curves';

const SAMPLES = [
  '01-room-lamp', '02-brick-wall', '03-forest', '05-statue', '06-sky',
];

const ABOUT =
  'A perception-simulation art/education tool: it renders a photo — or your ' +
  'live camera — as if the camera itself were the altered observer. All ' +
  'processing happens on your device; nothing is uploaded. Intensity is ' +
  'expressed in phenomenology-literature tiers, never doses.';

const GATE_KEY = 'dosed-lens-deliriant-ack';

// thin-stroke line icons (currentColor) — quieter than emoji, on-brand
const ICON = {
  flip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-14.9 6.7L3 16"/><path d="M3 12a9 9 0 0 1 14.9-6.7L21 8"/><path d="M3 21v-5h5"/><path d="M21 3v5h-5"/></svg>',
  mirror: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M8 7 3 12l5 5"/><path d="M16 7l5 5-5 5" opacity=".45"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6.5" width="13" height="11" rx="2.5"/><path d="m15.5 10 6-3v10l-6-3"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

export interface PanelCallbacks extends ToggleActions, OverrideCallbacks {
  onSubstance(id: string): void;
  onIntensity(v: number): void;
  onSample(url: string): void;
  onUpload(file: File): void;
  /** toggle the webcam as the live source; panel reflects via setWebcam */
  onWebcam(): void;
  onMirror(on: boolean): void;
  onFlip(): void;
}

export interface Panel {
  setSubstance(p: Profile, initialOverrides?: Record<string, number>): void;
  setIntensity(v: number): void;
  setPaused(p: boolean): void;
  setActiveSample(name: string | null): void;
  /** Reflect webcam on/off — switches the whole UI between browse & camera. */
  setWebcam(on: boolean): void;
  /** Show/hide the flip-camera control (only when >1 camera exists). */
  setFlipAvailable(available: boolean): void;
  /** Reflect the mirror state (front cam on, back cam off). */
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
      <div class="sheet-grip" id="grip"><span></span></div>
      <div class="hd"><h1>Dosed<br>Lens</h1><div class="lv" id="lv"></div></div>
      <div class="sub">${ABOUT}</div>
      <div class="sec">substance</div>
      <div id="picker"></div>
      <div class="sec">intensity</div>
      <div id="slider"></div>
      <div class="note" id="note"></div>
      <div class="sec">source</div>
      <label class="drop-tile" id="drop">
        <span class="drop-ic">${ICON.upload}</span>
        <span class="drop-txt"><b>Upload a photo</b><i>drop anywhere · or tap to browse</i></span>
        <input type="file" accept="image/*" id="file">
      </label>
      <button class="btn wide cam-cta" id="webcam"><span class="dot"></span>use live camera</button>
      <div class="note" id="cam-err"></div>
      <div class="sec">samples</div>
      <div class="samples" id="samples"></div>
      <div id="actions"></div>
      <div id="overrides" class="overrides"></div>
      <div class="hint"><kbd>H</kbd> panel · <kbd>space</kbd> pause · <kbd>1–5</kbd> tiers · drop an image anywhere</div>
    </div>

    <div id="camera">
      <div class="cam-top">
        <button class="cam-icon" id="cam-exit" aria-label="exit camera">${ICON.close}</button>
        <div class="cam-placard" id="cam-name">—</div>
        <div class="cam-top-r">
          <button class="cam-icon" id="cam-mirror" aria-label="mirror">${ICON.mirror}</button>
          <button class="cam-icon cam-flip" id="cam-flip" aria-label="flip camera">${ICON.flip}</button>
        </div>
      </div>
      <div class="cam-bottom">
        <div class="cam-int">
          <input type="range" min="0" max="1" step="0.005" id="cam-int" aria-label="intensity">
          <span class="cam-tier" id="cam-tier">Common</span>
        </div>
        <div class="cam-reel" id="cam-reel"></div>
        <div class="cam-shutter-row">
          <button class="cam-icon lg" id="cam-upload" aria-label="load a photo instead">${ICON.upload}</button>
          <button class="cam-shutter" id="cam-shutter" aria-label="capture"><span></span></button>
          <button class="cam-icon lg" id="cam-video" aria-label="switch to video">${ICON.video}</button>
        </div>
      </div>
      <div class="cam-toast" id="cam-toast"></div>
    </div>
    <div id="cam-flash"></div>

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

  // ---- deliriant gate: intercept deliriant picks until acknowledged once ----
  let pendingGateId: string | null = null;
  const gated = (p: Profile) =>
    p.class === 'deliriant' && !localStorage.getItem(GATE_KEY);
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

  // ---- samples ----
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

  // ---- shared file input (browse drop-tile + camera upload icon) ----
  const fileInput = root.querySelector<HTMLInputElement>('#file')!;
  fileInput.addEventListener('change', (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) cb.onUpload(f);
    fileInput.value = ''; // allow re-selecting the same file
  });
  addEventListener('dragover', (e) => e.preventDefault());
  addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f && f.type.startsWith('image/')) cb.onUpload(f);
  });

  // ================= camera-mode chrome =================
  const camName = root.querySelector<HTMLElement>('#cam-name')!;
  const camTier = root.querySelector<HTMLElement>('#cam-tier')!;
  const camInt = root.querySelector<HTMLInputElement>('#cam-int')!;
  const camReel = root.querySelector<HTMLElement>('#cam-reel')!;
  const camFlip = root.querySelector<HTMLButtonElement>('#cam-flip')!;
  const camMirror = root.querySelector<HTMLButtonElement>('#cam-mirror')!;
  const camShutter = root.querySelector<HTMLButtonElement>('#cam-shutter')!;
  const camVideo = root.querySelector<HTMLButtonElement>('#cam-video')!;
  const camToast = root.querySelector<HTMLElement>('#cam-toast')!;
  const camErr = root.querySelector<HTMLElement>('#cam-err')!;
  const flash = root.querySelector<HTMLElement>('#cam-flash')!;
  const webcamBtn = root.querySelector<HTMLButtonElement>('#webcam')!;

  let curIntensity = 0.5;
  let lastId = '';

  // effect reel: every substance as a filter chip
  const reelChips = new Map<string, HTMLButtonElement>();
  for (const [id, p] of profiles) {
    const b = document.createElement('button');
    b.className = 'reel-chip';
    if (p.class === 'deliriant') b.classList.add('warn');
    b.textContent = p.name;
    b.addEventListener('click', () => pick(id));
    reelChips.set(id, b);
    camReel.appendChild(b);
  }
  function reelActive(id: string, scroll: boolean): void {
    for (const [k, b] of reelChips) {
      const on = k === id;
      b.classList.toggle('on', on);
      if (on && scroll) b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }

  function setTierLabel(v: number): void {
    camTier.textContent = TIER_NAMES[tierIndex(v)];
  }

  // camera intensity slider (mirrors the browse slider, same callback)
  camInt.addEventListener('input', () => {
    const v = +camInt.value;
    curIntensity = v;
    setTierLabel(v);
    cb.onIntensity(v);
  });

  // capture: shutter takes a PNG (photo) or toggles recording (video mode)
  let capMode: 'photo' | 'video' = 'photo';
  let recording = false;
  camVideo.addEventListener('click', () => {
    if (recording) { // leaving video while recording → stop first
      recording = cb.onWebM();
      camShutter.classList.remove('recording');
    }
    capMode = capMode === 'photo' ? 'video' : 'photo';
    camVideo.classList.toggle('on', capMode === 'video');
    camShutter.classList.toggle('video', capMode === 'video');
  });
  camShutter.addEventListener('click', () => {
    if (capMode === 'photo') {
      cb.onPNG();
      flash.classList.remove('go');
      void flash.offsetWidth; // restart the animation
      flash.classList.add('go');
      toast('saved photo');
    } else {
      recording = cb.onWebM();
      camShutter.classList.toggle('recording', recording);
      toast(recording ? 'recording…' : 'saved video');
    }
  });

  let toastT = 0;
  function toast(msg: string): void {
    camToast.textContent = msg;
    camToast.classList.add('show');
    clearTimeout(toastT);
    toastT = window.setTimeout(() => camToast.classList.remove('show'), 1600);
  }

  root.querySelector('#cam-exit')!.addEventListener('click', () => cb.onWebcam());
  root.querySelector('#cam-upload')!.addEventListener('click', () => fileInput.click());
  camFlip.addEventListener('click', () => cb.onFlip());
  camMirror.addEventListener('click', () => {
    const on = !camMirror.classList.contains('on');
    cb.onMirror(on);
    camMirror.classList.toggle('on', on);
  });
  webcamBtn.addEventListener('click', () => cb.onWebcam());

  // ================= browse-mode sheet / panel visibility =================
  const tap = root.querySelector<HTMLElement>('#tap')!;
  const menuBtn = root.querySelector<HTMLButtonElement>('#menu')!;
  const grip = root.querySelector<HTMLElement>('#grip')!;

  type Sheet = 'full' | 'half' | 'closed';
  let sheet: Sheet = 'full';
  const isMobile = () => matchMedia('(max-width:640px)').matches;
  const OFFSET: Record<Sheet, number> = { full: 0, half: 0.46, closed: 1 };

  function applyPanel(): void {
    if (isMobile()) {
      panel.classList.remove('hidden');
      panel.classList.toggle('sheet-half', sheet === 'half');
      panel.classList.toggle('sheet-closed', sheet === 'closed');
      panel.style.transform = '';
      menuBtn.classList.toggle('on', sheet !== 'closed');
    } else {
      panel.classList.remove('sheet-half', 'sheet-closed');
      panel.style.transform = '';
      menuBtn.classList.toggle('on', !panel.classList.contains('hidden'));
    }
  }

  function togglePanel(): void {
    if (isMobile()) {
      sheet = sheet === 'closed' ? 'full' : 'closed';
      applyPanel();
    } else {
      const hidden = panel.classList.toggle('hidden');
      tap.classList.toggle('show', hidden);
      menuBtn.classList.toggle('on', !hidden);
    }
  }

  menuBtn.classList.add('on');
  menuBtn.addEventListener('click', togglePanel);
  addEventListener('keydown', (e) => {
    if ((e.key === 'h' || e.key === 'H') && !(e.target instanceof HTMLInputElement)) {
      togglePanel();
    }
  });
  addEventListener('resize', applyPanel);
  applyPanel();

  // ---- drag the grip to move/snap the sheet (mobile browse only) ----
  let dragging = false;
  let startY = 0;
  let panelH = 1;
  let lastY = 0;
  let lastT = 0;
  let vel = 0;

  grip.addEventListener('pointerdown', (e) => {
    if (!isMobile()) return;
    dragging = true;
    startY = e.clientY;
    panelH = panel.getBoundingClientRect().height;
    lastY = e.clientY;
    lastT = performance.now();
    vel = 0;
    panel.classList.add('dragging');
    try { grip.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  });
  grip.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const base = OFFSET[sheet] * panelH;
    const offset = Math.min(panelH, Math.max(0, base + (e.clientY - startY)));
    panel.style.transform = `translateY(${offset}px)`;
    const now = performance.now();
    if (now > lastT) vel = (e.clientY - lastY) / (now - lastT);
    lastY = e.clientY;
    lastT = now;
  });
  function endDrag(e: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove('dragging');
    const base = OFFSET[sheet] * panelH;
    const offset = Math.min(panelH, Math.max(0, base + (e.clientY - startY)));
    sheet = snapSheet(offset / panelH, vel);
    applyPanel();
  }
  grip.addEventListener('pointerup', endDrag);
  grip.addEventListener('pointercancel', endDrag);

  function snapSheet(frac: number, v: number): Sheet {
    const order: Sheet[] = ['full', 'half', 'closed'];
    const offs = [OFFSET.full, OFFSET.half, OFFSET.closed];
    let idx = 0;
    let bd = Infinity;
    offs.forEach((o, i) => {
      const d = Math.abs(o - frac);
      if (d < bd) { bd = d; idx = i; }
    });
    if (v > 1.2 && idx < 2) idx++;
    else if (v < -1.2 && idx > 0) idx--;
    return order[idx];
  }

  return {
    setSubstance(p, initialOverrides) {
      lastId = p.id;
      picker.setActive(p.id);
      overrides.rebuild(p, initialOverrides);
      lv.textContent = p.name.toUpperCase();
      camName.textContent = p.name.toUpperCase();
      reelActive(p.id, root.classList.contains('mode-camera'));
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
    setIntensity(v) {
      curIntensity = v;
      slider.set(v);
      camInt.value = String(v);
      setTierLabel(v);
    },
    setPaused: (p) => toggles.setPaused(p),
    setActiveSample(name) {
      for (const [n, img] of sampleImgs) img.classList.toggle('on', n === name);
    },
    setWebcam(on) {
      root.classList.toggle('mode-camera', on);
      webcamBtn.classList.toggle('on', on);
      if (on) {
        camInt.value = String(curIntensity);
        setTierLabel(curIntensity);
        reelActive(lastId, true);
        camErr.classList.remove('show');
      } else {
        slider.set(curIntensity);
        // reset capture state so the next camera session starts on photo
        recording = false;
        capMode = 'photo';
        camVideo.classList.remove('on');
        camShutter.classList.remove('recording', 'video');
      }
    },
    setFlipAvailable(available) {
      camFlip.classList.toggle('show', available);
    },
    setMirror(on) {
      camMirror.classList.toggle('on', on);
    },
    setWebcamError(msg) {
      camErr.textContent = msg ? '⚠ ' + msg : '';
      camErr.classList.toggle('show', !!msg);
      if (msg && root.classList.contains('mode-camera')) toast(msg);
    },
    pick,
  };
}

export function setFPS(text: string): void {
  const el = document.getElementById('fps');
  if (el) el.textContent = text;
}
