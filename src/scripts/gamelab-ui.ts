// Game Lab play screen: draws the falling-items board and runs the player's code in a test or live.
import {createMatch, judgeGame, missionBySlug, W, H} from '../lib/quest/gamelab.mjs';
import {complete, read, save} from '../lib/progress';
import {readStars, saveStars} from '../lib/quest/stars';

const root = document.querySelector<HTMLElement>('.lab-game')!;
const mission = missionBySlug(root.dataset.mission!)!;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const editor = $<HTMLTextAreaElement>('lab-code'), numbers = $('lab-lines'), board = $('lab-board'), feedback = $('lab-feedback');
const result = $('lab-result'), run = $<HTMLButtonElement>('lab-run'), play = $<HTMLButtonElement>('lab-play'), stop = $<HTMLButtonElement>('lab-stop'), resetButton = $<HTMLButtonElement>('lab-reset');
const MAX_CODE = 20000, CELL = 48, PAD = 8, INK = '#164b3b';
const storageKey = 'lab-code-' + mission.slug;
const starKey = 'lab-' + mission.slug;
let timer: ReturnType<typeof setInterval> | undefined;
let busy = false, pendingKey: string | null = null, hintIndex = 0, escaped = false;

// ---------- Drawing ----------
interface Item { x: number; y: number; kind: string }
interface Frame { px: number; items: Item[]; score: number; lives: number; said: string; caught?: number[]; hit?: number[] }
function draw(frame: Frame) {
  const width = W * CELL + PAD * 2, height = H * CELL + PAD * 2;
  const at = (x: number, y: number) => `translate(${PAD + x * CELL + CELL / 2} ${PAD + y * CELL + CELL / 2})`;
  let svg = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false"><rect width="${width}" height="${height}" rx="18" fill="#bfe3ee"/>`;
  svg += `<rect x="${PAD}" y="${PAD + (H - 1) * CELL}" width="${W * CELL}" height="${CELL}" rx="10" fill="#dff3b6" stroke="#9cc474" stroke-width="3"/>`;
  for (let x = 1; x < W; x++) svg += `<path d="M${PAD + x * CELL} ${PAD}v${H * CELL}" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/>`;
  for (const item of frame.items) {
    if (item.kind === 'coin') svg += `<g transform="${at(item.x, item.y)}"><circle r="15" fill="#ffcf58" stroke="${INK}" stroke-width="3"/><circle r="8" fill="none" stroke="#c48a00" stroke-width="3"/></g>`;
    else svg += `<g transform="${at(item.x, item.y)}"><path d="M-17 12q-6-14 4-22q8-10 20-6q12 3 14 15q3 9-3 13z" fill="#98a093" stroke="#4f5a50" stroke-width="3" stroke-linejoin="round"/><path d="M-8-4q5-6 12-5" fill="none" stroke="#d5dbcf" stroke-width="3" stroke-linecap="round"/></g>`;
  }
  svg += `<g transform="${at(frame.px, H - 1)}" class="lab-bit"><rect x="-19" y="-19" width="38" height="38" rx="12" fill="#b9ef79" stroke="${INK}" stroke-width="3"/><rect x="-14" y="-14" width="28" height="14" rx="7" fill="${INK}"/><ellipse cx="-6" cy="-7" rx="2.6" ry="3.6" fill="#fcf8e9"/><ellipse cx="6" cy="-7" rx="2.6" ry="3.6" fill="#fcf8e9"/><path d="M-5 8q5 4 10 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g></svg>`;
  board.innerHTML = svg; // numbers only: no player text is ever placed in this markup
  $('lab-score').textContent = String(frame.score);
  $('lab-lives').textContent = '♥'.repeat(Math.max(0, frame.lives)) + '♡'.repeat(Math.max(0, 3 - frame.lives));
  $('lab-said').textContent = frame.said || '';
}
const start = (): Frame => ({px: mission.playerX ?? 4, items: [], score: 0, lives: 3, said: ''});

// ---------- Editor ----------
function refreshLines() {
  numbers.textContent = Array.from({length: editor.value.split('\n').length}, (_, i) => String(i + 1)).join('\n');
  numbers.scrollTop = editor.scrollTop;
}
function store() { save(storageKey, editor.value); refreshLines(); }
function edit(text: string, from: number, to: number, caret: number) {
  editor.setRangeText(text, from, to, 'end');
  editor.selectionStart = editor.selectionEnd = caret;
  result.hidden = true;
  store();
}
editor.addEventListener('input', () => { result.hidden = true; store(); });
editor.addEventListener('scroll', () => { numbers.scrollTop = editor.scrollTop; });
editor.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); runTest(); return; }
  if (event.key === 'Escape') { escaped = true; return; }
  const {selectionStart: s, selectionEnd: e, value} = editor;
  const lineStart = value.lastIndexOf('\n', s - 1) + 1, before = value.slice(lineStart, s);
  if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) {
    if (escaped) { escaped = false; return; }
    event.preventDefault();
    if (event.shiftKey) {
      const remove = Math.min(4, value.slice(lineStart).match(/^ */)![0].length);
      if (remove) edit('', lineStart, lineStart + remove, Math.max(lineStart, s - remove));
    } else { const add = 4 - (before.length % 4); edit(' '.repeat(add), s, e, s + add); }
    return;
  }
  escaped = false;
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    const indent = before.match(/^ */)![0] + (/:\s*(#.*)?$/.test(before) ? '    ' : '');
    edit('\n' + indent, s, e, s + 1 + indent.length);
  } else if (event.key === 'Backspace' && s === e && before.length && /^ +$/.test(before)) {
    event.preventDefault();
    const remove = before.length % 4 || 4;
    edit('', s - remove, s, s - remove);
  }
});
root.querySelectorAll<HTMLButtonElement>('[data-insert]').forEach(button => button.addEventListener('click', () => {
  if (busy) return;
  const snippet = button.dataset.insert!, {value} = editor, cursor = editor.selectionStart;
  const lineStart = value.lastIndexOf('\n', cursor - 1) + 1;
  let lineEnd = value.indexOf('\n', cursor); if (lineEnd === -1) lineEnd = value.length;
  const current = value.slice(lineStart, lineEnd);
  // Function definitions and variables start at the left edge; everything else lines up with the code around it.
  const topLevel = /^(def|global) /.test(snippet) ? (snippet.startsWith('global') ? null : '') : null;
  let indent = topLevel ?? current.match(/^ */)![0];
  if (topLevel === null && /:\s*(#.*)?$/.test(current)) indent += '    ';
  if (snippet.startsWith('global') && !/^ +/.test(current)) indent = '    ';
  let text = (current.trim() ? '\n' : '') + (topLevel === '' && current.trim() ? '\n' : '') + indent + snippet;
  if (snippet.endsWith(':')) text += '\n' + indent + '    ';
  if (value.length + text.length > MAX_CODE) return;
  const from = current.trim() ? lineEnd : lineStart, to = current.trim() ? lineEnd : lineEnd;
  edit(text, from, to, from + text.length);
  editor.focus();
}));

// ---------- Messages and stars ----------
const message = (text: string, kind = '') => { feedback.textContent = text; feedback.className = 'feedback ' + kind; };
const starText = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
function showBest() {
  const best = readStars()[starKey] || 0;
  $('lab-best').textContent = best ? `Your best: ${starText(best)}` : 'No stars here yet';
}
function showGoals(goals?: {solved: boolean; idea: boolean; short: boolean}) {
  root.querySelectorAll<HTMLElement>('[data-goal]').forEach(item => {
    const done = !!goals && goals[item.dataset.goal as 'solved' | 'idea' | 'short'];
    item.classList.toggle('done', done);
    item.querySelector('.quest-goal-star')!.textContent = done ? '★' : '☆';
    item.querySelector('.sr-only')!.textContent = done ? 'Earned: ' : 'Not yet: ';
  });
}
function celebrate(stars: number, note: string, goals?: {solved: boolean; idea: boolean; short: boolean}) {
  saveStars(starKey, stars);
  complete('lab-' + mission.slug);
  showBest();
  if (goals) showGoals(goals);
  $('lab-result-stars').textContent = starText(stars);
  $('lab-result-stars').setAttribute('aria-label', `${stars} of 3 stars`);
  $('lab-result-title').textContent = stars === 3 ? 'Three stars! Perfect.' : 'Mission complete!';
  $('lab-result-note').textContent = note;
  result.hidden = false;
  result.classList.remove('pop'); void result.offsetWidth; result.classList.add('pop');
}
function tips(goals: {idea: boolean; short: boolean}, lines: number) {
  const out: string[] = [];
  if (!goals.idea) out.push(`For another star: ${mission.idea.label.charAt(0).toLowerCase() + mission.idea.label.slice(1)}.`);
  if (!goals.short) out.push(`For another star: use ${mission.lines} lines or fewer. Yours has ${lines}.`);
  return out.length ? out.join(' ') : 'You reached the target, used the new idea, and kept your code short.';
}

// ---------- Running ----------
function setBusy(value: boolean) {
  busy = value;
  run.disabled = play.disabled = resetButton.disabled = value;
  stop.disabled = !value;
  editor.readOnly = value;
  root.querySelectorAll<HTMLButtonElement>('[data-insert]').forEach(b => { b.disabled = value; });
}
function halt(text = '') {
  clearInterval(timer);
  timer = undefined;
  pendingKey = null;
  setBusy(false);
  draw(start());
  if (text) message(text);
}
function reportError(match: ReturnType<typeof createMatch>) {
  const error = match.error!;
  message(`${error.line ? `Line ${error.line}: ` : ''}${error.message}`, 'error');
}
function runTest() {
  if (busy) return;
  if (editor.value.length > MAX_CODE) { message('This program is too long. Try a function to shorten it.', 'error'); return; }
  result.hidden = true;
  showGoals();
  const match = createMatch(mission, editor.value);
  draw(start());
  if (match.status === 'error') { reportError(match); return; }
  setBusy(true);
  message(mission.testKeys ? 'Testing with a scripted player pressing keys…' : 'Testing your game…');
  timer = setInterval(() => {
    const frame = match.step(mission.testKeys?.[match.tick] ?? null);
    if (frame) draw(frame);
    if (match.status === 'running') return;
    clearInterval(timer);
    timer = undefined;
    setBusy(false);
    finish(match);
  }, 170);
}
function finish(match: ReturnType<typeof createMatch>) {
  if (match.status === 'error') { reportError(match); return; }
  if (match.status === 'won') {
    const verdict = judgeGame(mission, editor.value);
    celebrate(verdict.stars, tips(verdict.goals, verdict.lines), verdict.goals);
    message(`Target reached! You earned ${verdict.stars} of 3 stars.`, 'success');
  } else if (match.status === 'lost') message('Bit ran out of lives. Rocks cost a life when you catch them, so look for a way to dodge.', 'error');
  else message(`Time ran out with ${match.state.score} of ${mission.target} points. Check what Bit does on every tick, then run the test again.`, 'error');
}
function playLive() {
  if (busy) return;
  const match = createMatch(mission, editor.value);
  draw(start());
  if (match.status === 'error') { reportError(match); return; }
  result.hidden = true;
  setBusy(true);
  (document.activeElement as HTMLElement | null)?.blur();
  message('Live! Use the arrow keys or the on-screen buttons. Press Esc or Stop to end.');
  timer = setInterval(() => {
    const frame = match.step(pendingKey);
    pendingKey = null;
    if (frame) draw(frame);
    if (match.status === 'running') return;
    clearInterval(timer);
    timer = undefined;
    setBusy(false);
    if (match.status === 'won' && mission.sandbox) {
      const goals = {solved: true, idea: (mission.idea.needs as string[]).every(f => match.features.has(f)), short: match.lines <= mission.lines};
      celebrate(1 + Number(goals.idea) + Number(goals.short), tips(goals, match.lines), goals);
      message('You won live!', 'success');
    } else if (match.status === 'won') message('You won live! Press Run test to check your code and earn stars.', 'success');
    else finish(match);
  }, 420);
}
document.addEventListener('keydown', event => {
  if (!busy || !timer) return;
  if (event.key === 'Escape') { halt('Stopped. Your code is safe.'); return; }
  const keys: Record<string, string> = {ArrowLeft: 'left', ArrowRight: 'right', ' ': 'space'};
  if (keys[event.key]) { pendingKey = keys[event.key]; event.preventDefault(); }
});
$('lab-left').addEventListener('click', () => { pendingKey = 'left'; });
$('lab-right').addEventListener('click', () => { pendingKey = 'right'; });
run.addEventListener('click', runTest);
play.addEventListener('click', playLive);
stop.addEventListener('click', () => halt('Stopped. Your code is safe. Change it, then try again.'));
const dialog = $<HTMLDialogElement>('lab-reset-dialog');
function restore() { editor.value = mission.starter; store(); result.hidden = true; showGoals(); halt('Starting code restored. What will you try?'); editor.focus(); }
resetButton.addEventListener('click', () => { if (editor.value === mission.starter || !dialog.showModal) restore(); else dialog.showModal(); });
$('lab-reset-confirm').addEventListener('click', () => { restore(); dialog.close(); });
$('lab-hint').addEventListener('click', () => {
  $('lab-hint-text').textContent = mission.hints[Math.min(hintIndex, mission.hints.length - 1)];
  hintIndex++;
  $('lab-hint').textContent = hintIndex < mission.hints.length ? 'Another hint, please' : 'Show the hint again';
});
window.addEventListener('pagehide', () => { clearInterval(timer); });

const draft = read(storageKey);
editor.value = typeof draft === 'string' && draft.length <= MAX_CODE ? draft : mission.starter;
refreshLines();
showBest();
draw(start());
