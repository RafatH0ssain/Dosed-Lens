/** Action row: pause, before/after split, PNG export, WebM record. */

export interface ToggleActions {
  onPause(paused: boolean): void;
  onSplit(on: boolean): void;
  onPNG(): void;
  onWebM(): boolean; // returns whether now recording
}

export function createToggles(root: HTMLElement, actions: ToggleActions): {
  setPaused(p: boolean): void;
} {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `
    <button data-a="pause">pause</button>
    <button data-a="split">split</button>
    <button data-a="png" title="save the current frame as PNG">png</button>
    <button data-a="webm" title="record WebM — auto-stops at 30 s, click again to stop sooner">rec</button>`;
  root.appendChild(row);

  const btn = (a: string) => row.querySelector<HTMLButtonElement>(`[data-a="${a}"]`)!;
  let paused = false;
  let split = false;

  btn('pause').addEventListener('click', () => setPaused(!paused));
  btn('split').addEventListener('click', () => {
    split = !split;
    btn('split').classList.toggle('on', split);
    actions.onSplit(split);
  });
  btn('png').addEventListener('click', () => actions.onPNG());
  btn('webm').addEventListener('click', () => {
    const rec = actions.onWebM();
    btn('webm').classList.toggle('on', rec);
    btn('webm').textContent = rec ? 'stop' : 'rec';
  });

  function setPaused(p: boolean) {
    paused = p;
    btn('pause').textContent = p ? 'resume' : 'pause';
    actions.onPause(p);
  }

  return { setPaused };
}
