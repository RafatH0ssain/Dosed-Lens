/** Substance picker, grouped by class, with a text search filter. */

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

  // search box above the groups
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'pick-search';
  search.placeholder = 'search…';
  search.setAttribute('aria-label', 'search substances');
  root.appendChild(search);

  const buttons = new Map<string, HTMLButtonElement>();
  const groups: { el: HTMLElement; grid: HTMLElement; items: Profile[] }[] = [];
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
    groups.push({ el: h, grid, items: list });
  }

  function applyFilter(): void {
    const q = search.value.trim().toLowerCase();
    for (const g of groups) {
      let anyVisible = false;
      for (const p of g.items) {
        const hit =
          q === '' ||
          p.name.toLowerCase().includes(q) ||
          p.id.includes(q) ||
          p.class.includes(q);
        const b = buttons.get(p.id)!;
        b.style.display = hit ? '' : 'none';
        anyVisible ||= hit;
      }
      // hide a group header + grid when it has no matching substance
      g.el.style.display = anyVisible ? '' : 'none';
      g.grid.style.display = anyVisible ? '' : 'none';
    }
  }
  search.addEventListener('input', applyFilter);
  // Escape clears the filter
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && search.value) {
      e.stopPropagation();
      search.value = '';
      applyFilter();
    }
  });

  return {
    setActive(id: string) {
      for (const [pid, b] of buttons) b.classList.toggle('on', pid === id);
    },
  };
}
