// Code Quest level builder: paint a board, play it, and share it as a link.
import {mountGame} from './quest/game';
import {parseMap, encodeShare, decodeShare} from '../lib/quest/world.mjs';

const W = 8, H = 6;
type Tile = 'water' | 'floor' | 'rock' | 'crystal' | 'orange' | 'blue';
const CHAR: Record<Tile, string> = {water: ' ', floor: '.', rock: '#', crystal: '*', orange: 'o', blue: 'b'};
const FROM_CHAR: Record<string, Tile> = {' ': 'water', '.': 'floor', '#': 'rock', '*': 'crystal', o: 'orange', b: 'blue'};
const GLYPH: Record<string, string> = {water: '', floor: '', rock: '●', crystal: '◆', orange: '◯', blue: '≡'};
const ARROWS = ['▲', '▶', '▼', '◀'];
const HEADING = ['up', 'right', 'down', 'left'];
const START_CHAR = ['^', '>', 'v', '<'];
const SAMPLE = ['        ', ' >..*   ', '    .   ', '    ..* ', '        ', '        '];

const gridEl = document.querySelector<HTMLElement>('#builder-grid')!;
const status = document.querySelector<HTMLElement>('#builder-status')!;
const linkBox = document.querySelector<HTMLInputElement>('#builder-link')!;
const root = document.querySelector<HTMLElement>('.quest-game')!;

let tiles: Tile[][] = [];
let start = {x: 1, y: 1, dir: 1};
let brush: Tile | 'start' = 'floor';
let focus = {x: 0, y: 0};

function loadRows(rows: string[]) {
  const board = parseMap(rows);
  tiles = Array.from({length: H}, (_, y) => Array.from({length: W}, (_, x) => {
    const ch = rows[y]?.[x] ?? ' ';
    return FROM_CHAR[ch] ?? 'floor'; // the start tile is plain floor underneath
  }));
  start = {...board.start};
}
function rows() {
  return tiles.map((row, y) => row.map((tile, x) => start.x === x && start.y === y ? START_CHAR[start.dir] : CHAR[tile]).join(''));
}
function describe(x: number, y: number) {
  const here = start.x === x && start.y === y ? `Bit, facing ${HEADING[start.dir]}` : tiles[y][x] === 'floor' ? 'path' : tiles[y][x];
  return `Column ${x + 1}, row ${y + 1}: ${here}`;
}

const cells: HTMLButtonElement[][] = [];
function buildGrid() {
  gridEl.replaceChildren();
  for (let y = 0; y < H; y++) {
    cells.push([]);
    for (let x = 0; x < W; x++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'builder-cell';
      cell.addEventListener('click', () => { focus = {x, y}; paint(x, y); });
      cell.addEventListener('focus', () => { focus = {x, y}; roving(); });
      cells[y].push(cell);
      gridEl.append(cell);
    }
  }
  gridEl.addEventListener('keydown', event => {
    const move: Record<string, [number, number]> = {ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0]};
    const step = move[event.key];
    if (!step) return;
    event.preventDefault();
    focus = {x: Math.min(W - 1, Math.max(0, focus.x + step[0])), y: Math.min(H - 1, Math.max(0, focus.y + step[1]))};
    roving();
    cells[focus.y][focus.x].focus();
  });
}
/** Only one cell is in the Tab order; arrow keys move between cells. */
function roving() {
  cells.forEach((row, y) => row.forEach((cell, x) => { cell.tabIndex = x === focus.x && y === focus.y ? 0 : -1; }));
}
function draw() {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const cell = cells[y][x];
    const isStart = start.x === x && start.y === y;
    cell.dataset.tile = isStart ? 'start' : tiles[y][x];
    cell.textContent = isStart ? ARROWS[start.dir] : GLYPH[tiles[y][x]];
    cell.setAttribute('aria-label', describe(x, y));
  }
  roving();
}

function paint(x: number, y: number) {
  const isStart = start.x === x && start.y === y;
  if (brush === 'start') {
    if (isStart) start.dir = (start.dir + 1) % 4; // tap Bit again to turn it
    else { start = {x, y, dir: start.dir}; tiles[y][x] = 'floor'; }
  } else if (isStart) {
    status.textContent = 'That is Bit’s starting tile. Choose the Bit brush and tap another tile to move Bit first.';
    return;
  } else {
    tiles[y][x] = tiles[y][x] === brush && brush !== 'water' ? 'water' : brush; // tap again to erase
  }
  draw();
  apply();
}

const game = mountGame(root, {slug: 'custom', starter: '', map: SAMPLE}, {custom: true});
function apply(keepCode = true) {
  const map = rows();
  linkBox.value = '';
  linkBox.hidden = true;
  if (!map.join('').includes('*')) {
    status.textContent = 'Add at least one crystal so there is something for Bit to collect.';
    return false;
  }
  game.setLevel({slug: 'custom', starter: '', map}, keepCode);
  status.textContent = 'Your level is ready. Write code below to test it, then share it.';
  return true;
}

document.querySelectorAll<HTMLButtonElement>('[data-brush]').forEach(button => button.addEventListener('click', () => {
  brush = button.dataset.brush as Tile | 'start';
  document.querySelectorAll<HTMLButtonElement>('[data-brush]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  status.textContent = brush === 'start' ? 'Tap a tile to move Bit there. Tap Bit again to turn it.' : brush === 'water' ? 'Tap a tile to turn it back into water.' : `Tap tiles to paint: ${button.textContent!.trim()}. Tap the same thing again to erase it.`;
}));

document.querySelector('#builder-share')?.addEventListener('click', async () => {
  if (!apply()) return;
  const code = encodeShare(parseMap(rows()));
  const url = `${location.origin}${location.pathname}#level=${code}`;
  history.replaceState(null, '', '#level=' + code);
  linkBox.value = url;
  linkBox.hidden = false;
  try {
    await navigator.clipboard.writeText(url);
    status.textContent = 'Link copied! Send it to a friend, and your level will open for them.';
  } catch {
    linkBox.select();
    status.textContent = 'Here is your link. Copy it and send it to a friend.';
  }
});
document.querySelector('#builder-clear')?.addEventListener('click', () => {
  tiles = Array.from({length: H}, () => Array.from({length: W}, () => 'water' as Tile));
  start = {x: 0, y: H - 1, dir: 1};
  tiles[start.y][start.x] = 'floor';
  history.replaceState(null, '', location.pathname);
  draw();
  apply();
});

function fromHash() {
  const match = location.hash.match(/^#level=(.+)$/);
  if (!match) return false;
  const shared = decodeShare(match[1]);
  if (!shared || shared.length > H || shared.some((row: string) => row.length > W)) {
    status.textContent = 'That shared link doesn’t contain a level we can open, so here is a sample to start from.';
    return false;
  }
  loadRows(shared);
  return true;
}

buildGrid();
const shared = fromHash();
if (!shared) loadRows(SAMPLE);
draw();
const note = status.textContent;
apply(false);
if (shared) status.textContent = 'A shared level! Write code below to solve it, or repaint it to make it your own.';
else if (note) status.textContent = note;
window.addEventListener('hashchange', () => { if (fromHash()) { draw(); apply(false); } });
