// Draws a Code Quest board as SVG and plays back the events of a run.
import {describeLayout} from '../../lib/quest/world.mjs';

export interface Layout {
  w: number; h: number; tiles: string[][];
  start: {x: number; y: number; dir: number};
  crystals: {x: number; y: number}[];
  signs: {x: number; y: number; value: number}[];
  scroll: unknown[] | null;
}
export interface Theme { water: string; tile: string; edge: string; line: string }
export interface QuestEvent { type: string; line: number; x?: number; y?: number; dir?: number; by?: number; got?: number; value?: number; text?: string }

const S = 64; // tile size in SVG units
const PAD = 12;
const NS = 'http://www.w3.org/2000/svg';
const INK = '#164b3b';
export const DEFAULT_THEME: Theme = {water: '#bfe3ee', tile: '#dff3b6', edge: '#9cc474', line: '#7ba657'};

function el(name: string, attrs: Record<string, string | number> = {}, parent?: Element) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent?.append(node);
  return node;
}
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Board {
  private svg!: SVGSVGElement;
  private bit!: SVGGElement;
  private bitTurn!: SVGGElement;
  private crystals: SVGGElement[] = [];
  private signs: SVGTextElement[] = [];
  private splash: SVGElement | null = null;
  private bubble: HTMLElement;
  private layout!: Layout;
  private angle = 0;
  private pos = {x: 0, y: 0};
  collected = 0;

  constructor(private host: HTMLElement, private theme: Theme = DEFAULT_THEME) {
    this.bubble = document.createElement('div');
    this.bubble.className = 'quest-bubble';
  }

  setTheme(theme: Theme) { this.theme = theme; }

  /** Draw a board from scratch with Bit on the start tile. */
  setLayout(layout: Layout) {
    this.layout = layout;
    const width = layout.w * S + PAD * 2;
    const height = layout.h * S + PAD * 2;
    const svg = el('svg', {viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true', focusable: 'false'}) as SVGSVGElement;
    svg.style.maxWidth = Math.max(260, layout.w * 78 + PAD * 2) + 'px';
    el('rect', {x: 0, y: 0, width, height, rx: 20, fill: this.theme.water}, svg);

    // Little waves on the water tiles, placed by a fixed pattern so they don't jump between redraws.
    for (let y = 0; y < layout.h; y++) for (let x = 0; x < layout.w; x++) {
      if (layout.tiles[y][x] !== 'water' || (x * 7 + y * 13) % 3 !== 0) continue;
      const wx = PAD + x * S + 14 + ((x * 5 + y * 3) % 4) * 6;
      const wy = PAD + y * S + 22 + ((x + y * 7) % 3) * 9;
      el('path', {d: `M${wx} ${wy}q5 -5 10 0t10 0`, fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.7, 'stroke-width': 2.5, 'stroke-linecap': 'round'}, svg);
    }

    const paint: Record<string, {fill: string; edge: string; line: string}> = {
      orange: {fill: '#ffb561', edge: '#d98a35', line: '#b0621a'},
      blue: {fill: '#8fc8f4', edge: '#5a9ad0', line: '#356fa3'},
    };
    for (let y = 0; y < layout.h; y++) for (let x = 0; x < layout.w; x++) {
      const tile = layout.tiles[y][x];
      if (tile === 'water') continue;
      const px = PAD + x * S, py = PAD + y * S;
      const colors = paint[tile] || {fill: this.theme.tile, edge: this.theme.edge, line: this.theme.line};
      el('rect', {x: px + 3, y: py + 8, width: S - 6, height: S - 8, rx: 13, fill: colors.edge}, svg);
      el('rect', {x: px + 3, y: py + 3, width: S - 6, height: S - 9, rx: 13, fill: colors.fill, stroke: colors.line, 'stroke-width': 1.5}, svg);
      const cx = px + S / 2, cy = py + S / 2 - 2;
      if (tile === 'orange') {
        // A ring marks orange tiles, so they are not told apart by color alone.
        el('circle', {cx, cy, r: 15, fill: 'none', stroke: '#b0621a', 'stroke-width': 4, 'stroke-opacity': 0.55}, svg);
      } else if (tile === 'blue') {
        // Stripes mark blue tiles.
        for (const offset of [-9, 0, 9]) el('path', {d: `M${cx - 14} ${cy + offset}h28`, stroke: '#356fa3', 'stroke-width': 4, 'stroke-opacity': 0.55, 'stroke-linecap': 'round'}, svg);
      } else if (tile === 'rock') {
        el('path', {d: `M${cx - 21} ${cy + 15}q-5 -15 5 -24q8 -11 20 -7q14 2 16 16q4 11 -3 15z`, fill: '#98a093', stroke: '#4f5a50', 'stroke-width': 3, 'stroke-linejoin': 'round'}, svg);
        el('path', {d: `M${cx - 11} ${cy - 5}q6 -7 13 -6`, fill: 'none', stroke: '#d5dbcf', 'stroke-width': 3, 'stroke-linecap': 'round'}, svg);
      }
    }

    // Start marker
    const sx = PAD + layout.start.x * S + S / 2, sy = PAD + layout.start.y * S + S / 2 - 2;
    el('circle', {cx: sx, cy: sy, r: 22, fill: 'none', stroke: INK, 'stroke-opacity': 0.28, 'stroke-width': 2, 'stroke-dasharray': '5 6'}, svg);

    this.crystals = layout.crystals.map(crystal => {
      const cx = PAD + crystal.x * S + S / 2, cy = PAD + crystal.y * S + S / 2 - 3;
      const outer = el('g', {transform: `translate(${cx} ${cy})`}, svg) as SVGGElement;
      const g = el('g', {class: 'quest-crystal'}, outer) as SVGGElement;
      el('ellipse', {cx: 0, cy: 21, rx: 11, ry: 3.5, fill: '#000', 'fill-opacity': 0.13}, g);
      el('path', {d: 'M0 -19L14 -5L0 17L-14 -5Z', fill: '#f0528a', stroke: '#8f2450', 'stroke-width': 2.5, 'stroke-linejoin': 'round'}, g);
      el('path', {d: 'M0 -19L5 -5L0 17L-5 -5Z', fill: '#ff9fc0'}, g);
      el('path', {d: 'M-14 -5h28', stroke: '#8f2450', 'stroke-width': 1.5, 'stroke-opacity': 0.6}, g);
      el('path', {d: 'M-7 -10l3 -4', stroke: '#fff', 'stroke-width': 2.5, 'stroke-linecap': 'round'}, g);
      return g;
    });

    // Bit, drawn from above and facing "up"; the inner group rotates to show the heading.
    this.bit = el('g', {class: 'quest-bit'}, svg) as SVGGElement;
    this.bitTurn = el('g', {class: 'quest-bit-turn'}, this.bit) as SVGGElement;
    const b = this.bitTurn;
    el('ellipse', {cx: 0, cy: 4, rx: 24, ry: 22, fill: '#000', 'fill-opacity': 0.12}, b);
    el('rect', {x: -27, y: -13, width: 8, height: 27, rx: 4, fill: INK}, b);
    el('rect', {x: 19, y: -13, width: 8, height: 27, rx: 4, fill: INK}, b);
    el('path', {d: 'M0 -31L8 -20H-8Z', fill: '#ff845c', stroke: INK, 'stroke-width': 2.5, 'stroke-linejoin': 'round'}, b);
    el('rect', {x: -21, y: -21, width: 42, height: 42, rx: 13, fill: '#b9ef79', stroke: INK, 'stroke-width': 3}, b);
    el('rect', {x: -15, y: -16, width: 30, height: 15, rx: 7, fill: INK}, b);
    el('ellipse', {cx: -6.5, cy: -8.5, rx: 2.8, ry: 3.8, fill: '#fcf8e9'}, b);
    el('ellipse', {cx: 6.5, cy: -8.5, rx: 2.8, ry: 3.8, fill: '#fcf8e9'}, b);
    el('circle', {cx: 0, cy: 9, r: 5.5, fill: '#ffb944', stroke: INK, 'stroke-width': 2.5}, b);

    // Signs sit in the corner of their tile and are drawn last, so one on Bit's own tile stays readable.
    this.signs = layout.signs.map(sign => {
      const cx = PAD + sign.x * S + S / 2, cy = PAD + sign.y * S + S / 2;
      const g = el('g', {class: 'quest-sign'}, svg);
      el('rect', {x: cx + 15, y: cy - 8, width: 5, height: 18, rx: 2, fill: '#8a5a33'}, g);
      el('rect', {x: cx + 3, y: cy - 30, width: 27, height: 23, rx: 5, fill: '#fff6d8', stroke: '#8a5a33', 'stroke-width': 2.5}, g);
      const text = el('text', {x: cx + 16.5, y: cy - 12.5, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700, fill: '#6b3f1d', 'font-family': 'Fredoka, sans-serif'}, g) as SVGTextElement;
      text.textContent = '?';
      return text;
    });

    // Boards with signs or a map keep a line free above the board for what Bit reads out.
    this.host.classList.toggle('talks', layout.signs.length > 0 || !!layout.scroll);
    this.host.replaceChildren(this.bubble, svg);
    this.svg = svg;
    this.host.setAttribute('aria-label', describeLayout(layout));
    this.reset(false);
  }

  /** Put everything back to the start of a run. */
  reset(animate = false) {
    this.svg.classList.toggle('quest-instant', !animate);
    this.splash?.remove();
    this.splash = null;
    this.collected = 0;
    this.crystals.forEach(c => c.classList.remove('got'));
    this.signs.forEach(s => { s.textContent = '?'; });
    this.bit.classList.remove('sunk', 'bonk');
    this.angle = this.layout.start.dir * 90;
    this.place(this.layout.start.x, this.layout.start.y);
    this.bitTurn.style.transform = `rotate(${this.angle}deg)`;
    this.hideBubble();
    // Read a layout property so the browser applies the instant jump before transitions come back on.
    void this.svg.getBoundingClientRect();
    this.svg.classList.remove('quest-instant');
  }

  private place(x: number, y: number) {
    this.pos = {x, y};
    this.bit.style.transform = `translate(${PAD + x * S + S / 2}px, ${PAD + y * S + S / 2 - 2}px)`;
  }

  private say(text: string) {
    this.bubble.textContent = text;
    this.bubble.classList.add('show');
  }
  hideBubble() { this.bubble.classList.remove('show'); this.bubble.textContent = ''; }

  /** Animate the events of a run. `alive` returns false once the run has been stopped. */
  async play(events: QuestEvent[], options: {step: number; onLine: (line: number) => void; onCollect: (count: number) => void; alive: () => boolean}) {
    const step = reducedMotion() ? Math.min(options.step, 90) : options.step;
    this.host.style.setProperty('--quest-step', step + 'ms');
    for (const event of events) {
      if (!options.alive()) return;
      options.onLine(event.line);
      switch (event.type) {
        case 'move':
          this.place(event.x!, event.y!);
          await wait(step);
          if (!options.alive()) return;
          if (event.got !== undefined) {
            this.crystals[event.got]?.classList.add('got');
            options.onCollect(++this.collected);
          }
          break;
        case 'turn':
          this.angle += (event.by === 2 ? 2 : event.by!) * 90;
          this.bitTurn.style.transform = `rotate(${this.angle}deg)`;
          await wait(step * 0.8);
          break;
        case 'bump': {
          const d = [[0, -1], [1, 0], [0, 1], [-1, 0]][event.dir!];
          const home = {...this.pos};
          this.place(home.x + d[0] * 0.28, home.y + d[1] * 0.28);
          await wait(step * 0.6);
          this.place(home.x, home.y);
          this.bit.classList.add('bonk');
          await wait(step);
          break;
        }
        case 'splash': {
          this.place(event.x!, event.y!);
          await wait(step);
          const cx = PAD + event.x! * S + S / 2, cy = PAD + event.y! * S + S / 2;
          this.splash = el('circle', {cx, cy, r: 24, class: 'quest-ripple', fill: 'none', stroke: '#fff', 'stroke-width': 4});
          this.svg.insertBefore(this.splash, this.bit);
          this.bit.classList.add('sunk');
          await wait(step);
          break;
        }
        case 'read': {
          const index = this.layout.signs.findIndex(s => s.x === event.x && s.y === event.y);
          if (this.signs[index]) this.signs[index].textContent = String(event.value);
          this.say(`The sign says ${event.value}`);
          await wait(step * 1.6);
          break;
        }
        case 'map':
          this.say(`The map says ${event.text}`);
          await wait(step * 2.2);
          break;
        case 'say':
          this.say(event.text || '');
          await wait(step * 2.2);
          break;
      }
    }
  }
}
