// The Code Quest play screen: code editor, command buttons, run loop, and results.
import {judge, layoutFor, variantCount} from '../../lib/quest/world.mjs';
import {complete, read, save} from '../../lib/progress';
import {readStars, saveStars} from '../../lib/quest/stars';
import {Board, DEFAULT_THEME, type Theme} from './board';

export interface GameLevel {
  slug: string;
  starter: string;
  map?: string[];
  variants?: unknown[];
  idea?: {label: string; needs: string[]} | null;
  lines?: number;
  hints?: string[];
}
interface Options { theme?: Theme; custom?: boolean; nextUrl?: string }

const MAX_CODE = 20000;
const SPEEDS: Record<string, number> = {normal: 430, fast: 150};

export function mountGame(root: HTMLElement, initial: GameLevel, options: Options = {}) {
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const editor = $<HTMLTextAreaElement>('quest-code');
  const numbers = $('quest-lines');
  const marker = $('quest-marker');
  const feedback = $('quest-feedback');
  const result = $('quest-result');
  const run = $<HTMLButtonElement>('quest-run');
  const stop = $<HTMLButtonElement>('quest-stop');
  const resetButton = $<HTMLButtonElement>('quest-reset');
  const speed = $<HTMLSelectElement>('quest-speed');
  const count = $('quest-count');
  const hintButton = root.querySelector<HTMLButtonElement>('#quest-hint');
  const hintText = root.querySelector<HTMLElement>('#quest-hint-text');
  const board = new Board($('quest-board'), options.theme || DEFAULT_THEME);

  let level = initial;
  let generation = 0;
  let running = false;
  let runs = 0;
  let hintIndex = 0;
  let escaped = false;
  const storageKey = () => 'quest-code-' + level.slug;

  // ---------- Editor ----------

  const lineHeight = () => parseFloat(getComputedStyle(editor).lineHeight) || 24;
  function refreshLines() {
    const total = editor.value.split('\n').length;
    numbers.textContent = Array.from({length: total}, (_, i) => String(i + 1)).join('\n');
    numbers.scrollTop = editor.scrollTop;
    positionMarker();
  }
  let markedLine = 0;
  function mark(line: number, kind: 'run' | 'error' | '' = 'run') {
    markedLine = line;
    marker.className = 'quest-marker' + (kind ? ' ' + kind : '');
    positionMarker();
    if (line > 0) {
      // Keep the glowing line in view while a long program runs.
      const top = (line - 1) * lineHeight();
      if (top < editor.scrollTop || top > editor.scrollTop + editor.clientHeight - lineHeight() * 2) editor.scrollTop = Math.max(0, top - editor.clientHeight / 2);
    }
  }
  function positionMarker() {
    marker.hidden = markedLine < 1;
    if (markedLine < 1) return;
    const padding = parseFloat(getComputedStyle(editor).paddingTop) || 0;
    marker.style.transform = `translateY(${padding + (markedLine - 1) * lineHeight() - editor.scrollTop}px)`;
    marker.style.height = lineHeight() + 'px';
  }
  function store() {
    if (!options.custom) save(storageKey(), editor.value);
    refreshLines();
  }
  function edited() {
    mark(0);
    result.hidden = true;
    store();
  }
  editor.addEventListener('input', edited);
  editor.addEventListener('scroll', () => { numbers.scrollTop = editor.scrollTop; positionMarker(); });

  function replaceRange(text: string, start: number, end: number, caret: number) {
    editor.setRangeText(text, start, end, 'end');
    editor.selectionStart = editor.selectionEnd = caret;
    edited();
  }
  editor.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); execute(); return; }
    if (event.key === 'Escape') { escaped = true; return; }
    const {selectionStart: start, selectionEnd: end, value} = editor;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const before = value.slice(lineStart, start);
    if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      // Esc then Tab moves focus on, so keyboard users are never trapped in the editor.
      if (escaped) { escaped = false; return; }
      event.preventDefault();
      if (event.shiftKey) {
        const remove = Math.min(4, value.slice(lineStart).match(/^ */)![0].length);
        if (remove) replaceRange('', lineStart, lineStart + remove, Math.max(lineStart, start - remove));
      } else {
        const add = 4 - (before.length % 4);
        replaceRange(' '.repeat(add), start, end, start + add);
      }
      return;
    }
    escaped = false;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      let indent = before.match(/^ */)![0];
      if (/:\s*(#.*)?$/.test(before)) indent += '    ';
      replaceRange('\n' + indent, start, end, start + 1 + indent.length);
      return;
    }
    if (event.key === 'Backspace' && start === end && before.length && /^ +$/.test(before)) {
      event.preventDefault();
      const remove = before.length % 4 || 4;
      replaceRange('', start - remove, start, start - remove);
    }
  });

  /** Drop a command onto its own line, indented to match the code around the cursor. */
  function insertSnippet(snippet: string) {
    if (running) return;
    const {value} = editor;
    const cursor = editor.selectionStart;
    const lineStart = value.lastIndexOf('\n', cursor - 1) + 1;
    let lineEnd = value.indexOf('\n', cursor);
    if (lineEnd === -1) lineEnd = value.length;
    const current = value.slice(lineStart, lineEnd);
    let indent = current.match(/^ */)![0];
    const opensBlock = snippet.endsWith(':');
    // "else:" and "elif" line up with the "if" above them, one step out from the code inside it.
    if (/^(else|elif)\b/.test(snippet) && indent.length >= 4 && !/^\s*(if|elif)\b.*:\s*$/.test(current)) indent = indent.slice(4);
    let text: string;
    let from: number;
    let to: number;
    if (!current.trim()) {
      text = indent + snippet;
      from = lineStart; to = lineEnd;
    } else {
      if (/:\s*(#.*)?$/.test(current) && !/^(else|elif)\b/.test(snippet)) indent += '    ';
      text = '\n' + indent + snippet;
      from = to = lineEnd;
    }
    if (opensBlock) text += '\n' + indent + '    ';
    if (value.length + text.length > MAX_CODE) return;
    replaceRange(text, from, to, from + text.length);
    editor.focus();
  }
  root.querySelectorAll<HTMLButtonElement>('[data-insert]').forEach(button => button.addEventListener('click', () => insertSnippet(button.dataset.insert!)));

  // ---------- Messages ----------

  function message(text: string, kind = '') {
    feedback.textContent = text;
    feedback.className = 'feedback ' + kind;
  }
  function crystalCount(collected: number, total: number) {
    count.textContent = `${collected} / ${total}`;
  }
  const starText = (earned: number) => '★'.repeat(earned) + '☆'.repeat(3 - earned);
  function showBest() {
    const best = options.custom ? 0 : readStars()[level.slug] || 0;
    const el = root.querySelector<HTMLElement>('#quest-best');
    if (el) {
      el.textContent = best ? `Your best: ${starText(best)}` : 'No stars here yet';
      el.setAttribute('aria-label', best ? `Your best: ${best} of 3 stars` : 'No stars here yet');
    }
  }
  function showGoals(goals?: {solved: boolean; idea: boolean; short: boolean}) {
    root.querySelectorAll<HTMLElement>('[data-goal]').forEach(item => {
      const done = !!goals && goals[item.dataset.goal as 'solved' | 'idea' | 'short'];
      item.classList.toggle('done', done);
      item.querySelector('.quest-goal-star')!.textContent = done ? '★' : '☆';
      item.querySelector('.sr-only')!.textContent = done ? 'Earned: ' : 'Not yet: ';
    });
  }

  // ---------- Running ----------

  function busy(value: boolean) {
    running = value;
    run.disabled = value;
    stop.disabled = !value;
    resetButton.disabled = value;
    editor.readOnly = value;
    root.querySelectorAll<HTMLButtonElement>('[data-insert]').forEach(button => { button.disabled = value; });
    root.classList.toggle('running', value);
  }
  function drawStart(variant = 0) {
    const layout = layoutFor(level, variant);
    board.setLayout(layout);
    crystalCount(0, layout.crystals.length);
  }

  async function execute() {
    if (running) return;
    const code = editor.value;
    result.hidden = true;
    showGoals();
    if (code.length > MAX_CODE) { message('This program is too long. Loops and functions can make it much shorter!', 'error'); return; }
    const verdict = judge(level, code, runs++);
    const outcome = verdict.result;
    const layout = layoutFor(level, verdict.variant);
    board.setLayout(layout);
    crystalCount(0, layout.crystals.length);
    if (outcome.status === 'empty') { mark(0); message('Type a command first, or tap one of the command buttons. Then press Run.'); return; }
    if (outcome.status === 'error' && outcome.error!.kind === 'syntax') {
      mark(outcome.error!.line, 'error');
      message(`${outcome.error!.line ? `Line ${outcome.error!.line}: ` : ''}${outcome.error!.message}`, 'error');
      return;
    }
    const token = ++generation;
    busy(true);
    message(verdict.lucky ? 'This level changes between runs. Watch what happens on this layout…' : 'Bit is following your code…');
    await board.play(outcome.events, {
      step: SPEEDS[speed.value] || SPEEDS.normal,
      onLine: line => mark(line),
      onCollect: collected => crystalCount(collected, layout.crystals.length),
      alive: () => token === generation,
    });
    if (token !== generation) return;
    busy(false);
    if (verdict.solved) {
      mark(0);
      win(verdict);
      return;
    }
    const where = outcome.error?.line ? `Line ${outcome.error.line}: ` : '';
    const changing = verdict.lucky ? ' Your code worked on another layout, but this level changes between runs, so it has to work every time.' : '';
    if (outcome.status === 'crash' || outcome.status === 'error') {
      mark(outcome.error!.line, 'error');
      message(where + outcome.error!.message + changing, 'error');
    } else if (outcome.status === 'win') {
      // Shown layout worked but another one failed; judge() normally shows the failing one instead.
      mark(0);
      message('That worked here, but not on every layout of this level. Press Run to see another one.', 'error');
    } else {
      mark(0);
      const left = outcome.total - outcome.collected;
      message(`The program finished, but ${left === 1 ? '1 crystal is' : left + ' crystals are'} still waiting. Add more code and run it again.${changing}`, 'error');
    }
  }

  function win(verdict: ReturnType<typeof judge>) {
    const title = result.querySelector<HTMLElement>('#quest-result-title')!;
    const stars = result.querySelector<HTMLElement>('#quest-result-stars')!;
    const note = result.querySelector<HTMLElement>('#quest-result-note')!;
    if (options.custom) {
      title.textContent = 'Level solved!';
      stars.hidden = true;
      note.textContent = `Your code collected every crystal in ${verdict.lines} line${verdict.lines === 1 ? '' : 's'}. Share the link so a friend can try it.`;
      message('Every crystal collected!', 'success');
    } else {
      saveStars(level.slug, verdict.stars);
      complete('quest-' + level.slug);
      showGoals(verdict.goals);
      showBest();
      stars.hidden = false;
      stars.textContent = starText(verdict.stars);
      stars.setAttribute('aria-label', `${verdict.stars} of 3 stars`);
      title.textContent = verdict.stars === 3 ? 'Three stars! Perfect.' : 'Level complete!';
      const tips: string[] = [];
      if (!verdict.goals.idea && level.idea) tips.push(`For another star: ${level.idea.label.charAt(0).toLowerCase() + level.idea.label.slice(1)}.`);
      if (!verdict.goals.short && level.lines) tips.push(`For another star: use ${level.lines} line${level.lines === 1 ? '' : 's'} or fewer. Yours has ${verdict.lines}.`);
      note.textContent = tips.length ? tips.join(' ') : 'You collected every crystal, used the new idea, and kept your code short.';
      message(`Every crystal collected! You earned ${verdict.stars} of 3 stars.`, 'success');
    }
    result.hidden = false;
    result.classList.remove('pop');
    void result.offsetWidth;
    result.classList.add('pop');
  }

  function halt(text: string) {
    generation++;
    busy(false);
    mark(0);
    drawStart(0);
    message(text);
  }

  run.addEventListener('click', execute);
  stop.addEventListener('click', () => halt('Stopped. Your code is safe. Change it, then press Run.'));
  const dialog = root.querySelector<HTMLDialogElement>('#quest-reset-dialog');
  resetButton.addEventListener('click', () => {
    if (editor.value === level.starter || !dialog?.showModal) { restore(); return; }
    dialog.showModal();
  });
  root.querySelector('#quest-reset-confirm')?.addEventListener('click', () => { restore(); dialog?.close(); });
  function restore() {
    editor.value = level.starter;
    store();
    result.hidden = true;
    showGoals();
    halt('Starting code restored. What will you try?');
    editor.focus();
  }
  hintButton?.addEventListener('click', () => {
    const hints = level.hints || [];
    if (!hints.length || !hintText) return;
    hintText.textContent = hints[Math.min(hintIndex, hints.length - 1)];
    hintIndex++;
    hintButton.textContent = hintIndex < hints.length ? 'Another hint, please' : 'Show the hint again';
    if (hintIndex >= hints.length) hintIndex = hints.length - 1;
  });
  window.addEventListener('pagehide', () => { generation++; });
  window.addEventListener('resize', positionMarker);

  // ---------- Loading a level ----------

  function load(next: GameLevel) {
    generation++;
    level = next;
    runs = 0;
    hintIndex = 0;
    busy(false);
    const draft = options.custom ? null : read(storageKey());
    editor.value = typeof draft === 'string' && draft.length <= MAX_CODE ? draft : level.starter;
    mark(0);
    refreshLines();
    result.hidden = true;
    showGoals();
    showBest();
    drawStart(0);
    const changing = variantCount(level) > 1;
    const note = root.querySelector<HTMLElement>('#quest-changing');
    if (note) note.hidden = !changing;
    message(options.custom ? 'Write code to collect every crystal, then press Run.' : 'Read the mission, write your code, then press Run.');
  }
  load(initial);

  return {
    /** Swap in a different level (used by the level builder). */
    setLevel(next: GameLevel, keepCode = false) {
      const code = editor.value;
      load(next);
      if (keepCode) { editor.value = code; refreshLines(); }
    },
    isRunning: () => running,
  };
}
