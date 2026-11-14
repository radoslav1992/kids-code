// The Code Quest world: a tile board, Bit the robot, and the commands programs can call.
// A run is computed all at once into a list of events; the page animates that list afterwards.
import {parse, execute, show, typeName, QuestError} from './lang.mjs';

export const HEADINGS = ['north', 'east', 'south', 'west'];
const DELTA = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const START = {'^': 0, '>': 1, 'v': 2, '<': 3};
const TILE = {'.': 'floor', ' ': 'water', '~': 'water', '-': 'water', '#': 'rock', '*': 'floor', 'o': 'orange', 'b': 'blue', 'O': 'orange', 'B': 'blue'};
const HAS_CRYSTAL = new Set(['*', 'O', 'B']);
export const MAX_ACTIONS = 600;
export const MAX_SIZE = 12;

/** Turn rows of map characters into a board. Short rows are padded with water. */
export function parseMap(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > MAX_SIZE) throw new Error('A map needs 1 to ' + MAX_SIZE + ' rows.');
  const h = rows.length;
  const w = Math.max(...rows.map(row => row.length));
  if (!w || w > MAX_SIZE) throw new Error('A map needs 1 to ' + MAX_SIZE + ' columns.');
  const tiles = [];
  const crystals = [];
  let start = null;
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] ?? ' ';
      if (ch in START) {
        if (start) throw new Error('A map can only have one starting place.');
        start = {x, y, dir: START[ch]};
        row.push('floor');
        continue;
      }
      if (!(ch in TILE)) throw new Error(`Unknown map character "${ch}".`);
      row.push(TILE[ch]);
      if (HAS_CRYSTAL.has(ch)) crystals.push({x, y});
    }
    tiles.push(row);
  }
  if (!start) throw new Error('A map needs a starting place.');
  return {w, h, tiles, start, crystals};
}

/** The board for one variant of a level. Levels that change between runs list several variants. */
export function layoutFor(level, variant = 0) {
  const source = level.variants ? level.variants[variant % level.variants.length] : level;
  const board = parseMap(source.map);
  const signs = (source.signs || []).map(sign => ({x: sign.x, y: sign.y, value: sign.value}));
  for (const sign of signs) {
    if (board.tiles[sign.y]?.[sign.x] === undefined || board.tiles[sign.y][sign.x] === 'water' || board.tiles[sign.y][sign.x] === 'rock') throw new Error('A sign must stand on a floor tile.');
  }
  return {...board, signs, scroll: source.scroll ? [...source.scroll] : null};
}

export const variantCount = level => level.variants ? level.variants.length : 1;

class Win {}

/**
 * Run a program on a board.
 * Returns {status, events, error, features, lines, collected, total}.
 * status: 'win' (every crystal collected), 'incomplete' (program ended early), 'crash' (rock or water),
 * 'error' (the code could not be read or stopped while running), 'empty' (no code to run).
 */
export function runProgram(layout, source) {
  const events = [];
  const total = layout.crystals.length;
  const result = {status: 'incomplete', events, error: null, features: new Set(), lines: 0, collected: 0, total};
  let program;
  try {
    program = parse(source);
  } catch (error) {
    if (!(error instanceof QuestError) && !(error instanceof RangeError)) throw error;
    result.status = 'error';
    result.error = error instanceof QuestError ? {line: error.line, message: error.message, kind: error.kind} : {line: 0, message: 'This program is nested too deeply for Bit to follow.', kind: 'syntax'};
    return result;
  }
  result.features = program.features;
  result.lines = program.lines;
  if (!program.body.length) { result.status = 'empty'; return result; }

  let {x, y, dir} = layout.start;
  const got = new Set();
  const crystalAt = new Map(layout.crystals.map((c, i) => [c.x + ',' + c.y, i]));
  const tileAt = (tx, ty) => layout.tiles[ty]?.[tx] ?? 'water';
  const walkable = (tx, ty) => { const tile = tileAt(tx, ty); return tile !== 'water' && tile !== 'rock'; };
  const record = event => {
    if (events.length >= MAX_ACTIONS) throw new QuestError('Bit is worn out! That was more than ' + MAX_ACTIONS + ' actions. Look for a loop that never ends.', event.line, 'limit');
    events.push(event);
  };
  const noArgs = (name, args, line) => {
    if (args.length) throw new QuestError(`${name}() doesn’t need anything inside its parentheses.`, line);
  };
  const turn = (amount, line) => { dir = (dir + amount + 4) % 4; record({type: 'turn', dir, by: amount, line}); };

  const commands = {
    move(args, line) {
      if (args.length > 1) throw new QuestError('move() takes one number, like move(3).', line);
      const steps = args.length ? args[0] : 1;
      if (typeof steps !== 'number') throw new QuestError(`move() needs a number, like move(3), but got ${typeName(steps)}.`, line);
      if (!Number.isInteger(steps)) throw new QuestError('Bit can only move a whole number of tiles.', line);
      if (steps < 0) throw new QuestError('Bit can’t move a negative number of tiles. Turn around instead!', line);
      for (let i = 0; i < steps; i++) {
        const nx = x + DELTA[dir][0];
        const ny = y + DELTA[dir][1];
        const tile = tileAt(nx, ny);
        if (tile === 'rock') {
          record({type: 'bump', dir, line});
          throw new QuestError('Bonk! A rock is in the way. Bit needs a path around it.', line, 'crash');
        }
        if (tile === 'water') {
          record({type: 'splash', x: nx, y: ny, dir, line});
          throw new QuestError('Splash! That tile is water, and Bit can’t swim.', line, 'crash');
        }
        x = nx; y = ny;
        const event = {type: 'move', x, y, dir, line};
        const crystal = crystalAt.get(x + ',' + y);
        if (crystal !== undefined && !got.has(crystal)) { got.add(crystal); event.got = crystal; }
        record(event);
        if (total > 0 && got.size === total) throw new Win();
      }
      return null;
    },
    turn_left(args, line) { noArgs('turn_left', args, line); turn(-1, line); return null; },
    turn_right(args, line) { noArgs('turn_right', args, line); turn(1, line); return null; },
    turn_around(args, line) { noArgs('turn_around', args, line); turn(2, line); return null; },
    path_clear(args, line) { noArgs('path_clear', args, line); return walkable(x + DELTA[dir][0], y + DELTA[dir][1]); },
    tile_color(args, line) { noArgs('tile_color', args, line); const tile = tileAt(x, y); return tile === 'orange' || tile === 'blue' ? tile : 'plain'; },
    crystals_left(args, line) { noArgs('crystals_left', args, line); return total - got.size; },
    read_sign(args, line) {
      noArgs('read_sign', args, line);
      const sign = layout.signs.find(s => s.x === x && s.y === y);
      if (!sign) throw new QuestError('There is no sign on this tile. Move Bit onto a sign first, then use read_sign().', line);
      record({type: 'read', x, y, value: sign.value, line});
      return sign.value;
    },
    read_map(args, line) {
      noArgs('read_map', args, line);
      if (!layout.scroll) throw new QuestError('Bit isn’t carrying a treasure map in this level.', line);
      record({type: 'map', text: show(layout.scroll), line});
      return [...layout.scroll];
    },
    say(args, line) {
      const text = args.map(a => show(a)).join(' ').slice(0, 80);
      record({type: 'say', text, line});
      return null;
    },
  };

  try {
    execute(program, {commands, print: (text, line) => record({type: 'say', text: String(text).slice(0, 80), line})});
  } catch (error) {
    if (error instanceof Win) {
      result.status = 'win';
    } else if (error instanceof QuestError) {
      result.status = error.kind === 'crash' ? 'crash' : 'error';
      result.error = {line: error.line, message: error.message, kind: error.kind};
    } else if (error instanceof RangeError) {
      result.status = 'error';
      result.error = {line: 0, message: 'This program is nested too deeply for Bit to follow.', kind: 'limit'};
    } else throw error;
  }
  result.collected = got.size;
  return result;
}

/**
 * Check a program against every variant of a level and work out its stars.
 * `show` picks which variant to animate; if the program fails somewhere, a failing variant is shown instead.
 */
export function judge(level, source, show = 0) {
  const count = variantCount(level);
  const runs = Array.from({length: count}, (_, k) => runProgram(layoutFor(level, k), source));
  const wanted = ((show % count) + count) % count;
  const failing = runs.findIndex(run => run.status !== 'win');
  const solved = failing === -1;
  const shown = solved || runs[wanted].status !== 'win' ? wanted : failing;
  const result = runs[shown];
  const needs = level.idea?.needs || [];
  const idea = solved && needs.every(feature => result.features.has(feature));
  const short = solved && (!level.lines || result.lines <= level.lines);
  return {
    variant: shown,
    result,
    solved,
    /** True when the layout the player asked for worked, but another layout of the same level did not. */
    lucky: !solved && shown !== wanted,
    goals: {solved, idea, short},
    stars: solved ? 1 + Number(idea) + Number(short) : 0,
    lines: result.lines,
  };
}

/** Plain-language description of a board for screen readers. */
export function describeLayout(layout) {
  const place = (x, y) => `column ${x + 1}, row ${y + 1}`;
  const list = type => {
    const found = [];
    layout.tiles.forEach((row, y) => row.forEach((tile, x) => { if (tile === type) found.push(place(x, y)); }));
    return found;
  };
  const parts = [`A board ${layout.w} tiles wide and ${layout.h} tiles tall. Rows count from the top.`, `Bit starts at ${place(layout.start.x, layout.start.y)}, facing ${HEADINGS[layout.start.dir]}.`];
  parts.push(`Crystals: ${layout.crystals.map(c => place(c.x, c.y)).join('; ') || 'none'}.`);
  const rocks = list('rock');
  if (rocks.length) parts.push(`Rocks: ${rocks.join('; ')}.`);
  for (const color of ['orange', 'blue']) { const found = list(color); if (found.length) parts.push(`${color[0].toUpperCase() + color.slice(1)} tiles: ${found.join('; ')}.`); }
  if (layout.signs.length) parts.push(`Signs: ${layout.signs.map(s => place(s.x, s.y)).join('; ')}.`);
  parts.push('Every tile that is not listed as path is water.');
  return parts.join(' ');
}

// ---------- Shareable custom levels (the level builder) ----------

const SHARE_OUT = {water: '-', floor: 'f', rock: 'r', orange: 'o', blue: 'b'};
const SHARE_IN = {'-': ' ', f: '.', r: '#', o: 'o', b: 'b', c: '*', n: '^', e: '>', s: 'v', w: '<'};
export const SHARE_MAX_W = 10;
export const SHARE_MAX_H = 8;

/** Encode a board as a short URL-safe string: one letter per tile, rows separated by dots. */
export function encodeShare(layout) {
  const crystals = new Set(layout.crystals.map(c => c.x + ',' + c.y));
  return layout.tiles.map((row, y) => row.map((tile, x) => {
    if (layout.start.x === x && layout.start.y === y) return 'nesw'[layout.start.dir];
    if (crystals.has(x + ',' + y)) return 'c';
    return SHARE_OUT[tile] || '-';
  }).join('')).join('.');
}

/** Decode a shared level. Returns map rows, or null if the text is not a valid level. Never runs anything. */
export function decodeShare(text) {
  if (typeof text !== 'string' || text.length > SHARE_MAX_W * SHARE_MAX_H + SHARE_MAX_H || !/^[-frobcnesw.]+$/.test(text)) return null;
  const rows = text.split('.');
  if (rows.length < 1 || rows.length > SHARE_MAX_H || rows.some(row => !row.length || row.length > SHARE_MAX_W)) return null;
  const map = rows.map(row => [...row].map(ch => SHARE_IN[ch]).join(''));
  try {
    const board = parseMap(map);
    if (!board.crystals.length) return null;
  } catch {
    return null;
  }
  return map;
}
