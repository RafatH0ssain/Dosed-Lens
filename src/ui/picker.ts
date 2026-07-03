/** Substance picker, grouped by class. Search filter arrives in M7. */

import type { Profile } from '../engine/resolver';

const CLASS_ORDER = [
  'psychedelic', 'dissociative', 'atypical', 'entactogen',
  'cannabinoid', 'depressant', 'stimulant', 'deliriant', 'opioid',
];

export function createPicker(
  root: HTMLElement,
  profiles: Map<string, Profile>,
  onPick: (id: string) => void,
): { setActive(id: string): void } {
  const byClass = new Map<string, Profile[]>();
  for (const p of profiles.values()) {
    const list = byClass.get(p.class) ?? [];
    list.push(p);
    byClass.set(p.class, list);
  }

  const buttons = new Map<string, HTMLButtonElement>();
  for (const cls of CLASS_ORDER) {
    const list = byClass.get(cls);
    if (!list) continue;
    const h = document.createElement('div');
    h.className = 'pick-group';
    h.textContent = cls;
    root.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'pick';
    for (const p of list) {
      const b = document.createElement('button');
      b.textContent = p.name;
      if (p.class === 'deliriant') b.classList.add('warn');
      b.addEventListener('click', () => onPick(p.id));
      buttons.set(p.id, b);
      grid.appendChild(b);
    }
    root.appendChild(grid);
  }

  return {
    setActive(id: string) {
      for (const [pid, b] of buttons) b.classList.toggle('on', pid === id);
    },
  };
}
