// Game Lab: kids write the rules of a tiny arcade game. Coins and rocks fall down a 9x7 board; the
// program defines on_key(key) and on_tick() and the engine calls them. Everything is deterministic
// so every mission can be checked automatically. All art, rules, and missions are original to KidsCode.
import {parse, execute, QuestError} from './lang.mjs';

export const W = 9;
export const H = 7;
export const PLAYER_Y = H - 1;
const MAX_ITEMS = 30;

/** Where a sweeper that bounces between the walls stands after each tick. */
function bouncePath(ticks) {
  const path = [];
  let x = 0, direction = 1;
  for (let t = 0; t < ticks; t++) {
    if (x === W - 1) direction = -1;
    if (x === 0) direction = 1;
    x += direction;
    path.push(x);
  }
  return path;
}
const sweep = bouncePath(60);

/** A small repeatable random generator (the same board every time). */
function lcg(seed) {
  let state = seed;
  return n => { state = (state * 1103515245 + 12345) % 2147483648; return Math.floor(state / 65536) % n; };
}
function freePlay() {
  const random = lcg(7);
  const spawns = [];
  let last = 4;
  for (let t = 0; t < 57; t += 3) {
    // Each coin lands within reach of the one before it, and a rock follows every coin.
    last = Math.min(W - 1, Math.max(0, last + random(7) - 3));
    spawns.push([t, last, 'coin']);
    spawns.push([t + 1, random(W), 'rock']);
  }
  return spawns;
}

export const TOOLS = {
  key: {label: 'def on_key(key):', insert: 'def on_key(key):', tip: 'Runs whenever a key is pressed'},
  tick: {label: 'def on_tick():', insert: 'def on_tick():', tip: 'Runs on every tick of the game clock'},
  move: {label: 'move_player(1)', insert: 'move_player(1)', tip: 'Slide Bit right (use -1 for left)'},
  if: {label: 'if key == "left":', insert: 'if key == "left":', tip: 'Do something only when the key matches'},
  coin: {label: 'coin_x()', insert: 'target = coin_x()', tip: 'The column of the lowest coin, or -1 when none is falling'},
  px: {label: 'player_x()', insert: 'player_x()', tip: 'The column Bit is standing in'},
  rock: {label: 'rock_x()', insert: 'rock_x()', tip: 'The column of the lowest rock, or -1 when none is falling'},
  global: {label: 'global direction', insert: 'global direction', tip: 'Let a function change a variable made outside it'},
  def: {label: 'def go_to(x):', insert: 'def go_to(x):', tip: 'Invent your own helper command'},
  say: {label: 'say("Nice!")', insert: 'say("Nice!")', tip: 'Show a message above the board'},
};

export const missions = [
  {
    slug: 'slide', title: 'Slide to catch', concept: 'An event is something that happens, like a key press. A function named on_key runs every time one does.',
    goal: 'Catch both coins by sliding Bit left and right with the keys.',
    story: 'Coins are falling and I can’t catch them standing still! Teach me what to do when you press an arrow key.',
    teach: {title: 'Events call your functions', text: 'The game calls on_key(key) each time a key is pressed. The parameter key holds "left" or "right". Use if to decide what each key does. move_player(-1) slides Bit one column left; move_player(1) slides right.', code: 'def on_key(key):\n    if key == "left":\n        move_player(-1)'},
    playerX: 4, ticks: 16, target: 2, tools: ['key', 'if', 'move'],
    spawns: [[0, 2, 'coin'], [8, 6, 'coin']],
    testKeys: {0: 'left', 1: 'left', 8: 'right', 9: 'right', 10: 'right', 11: 'right'},
    starter: 'def on_key(key):\n    if key == "left":\n        move_player(-1)\n',
    hints: ['The test run presses left twice, then right four times. Right now your code only knows what to do with left.', 'Add a second if for "right", lined up with the first, that calls move_player(1).'],
    idea: {label: 'Use if inside on_key', needs: ['def', 'if']}, lines: 5,
    solution: 'def on_key(key):\n    if key == "left":\n        move_player(-1)\n    if key == "right":\n        move_player(1)',
  },
  {
    slug: 'autopilot', title: 'Autopilot', concept: 'on_tick runs on every tick of the game clock, so Bit can play by itself by checking where the coin is.',
    goal: 'Write an autopilot that catches four coins with no keys at all.',
    story: 'My hands are tired! Let me look at the coins myself. coin_x() tells me which column the lowest coin is in.',
    teach: {title: 'A clock that never sleeps', text: 'on_tick() is called once per tick. coin_x() answers with the column of the lowest falling coin, or -1 when there is none. Compare it with player_x() to decide which way to slide. Always check for -1 first, or Bit will run to the wall looking for a coin that isn’t there!', code: 'def on_tick():\n    target = coin_x()\n    if target >= 0:\n        if target > player_x():\n            move_player(1)'},
    playerX: 4, ticks: 30, target: 4, tools: ['tick', 'coin', 'px', 'if', 'move'],
    spawns: [[0, 1, 'coin'], [8, 7, 'coin'], [16, 2, 'coin'], [24, 6, 'coin']],
    testKeys: null,
    starter: 'def on_tick():\n    target = coin_x()\n    if target > player_x():\n        move_player(1)\n',
    hints: ['This starter only slides right. The first coin is on the left! Add an elif that slides left.', 'Check target >= 0 first so Bit stays still when no coin is falling. Then use if / elif to slide toward it.'],
    idea: {label: 'Use on_tick with coin_x()', needs: ['def', 'call:coin_x']}, lines: 8,
    solution: 'def on_tick():\n    target = coin_x()\n    if target >= 0:\n        if target > player_x():\n            move_player(1)\n        elif target < player_x():\n            move_player(-1)',
  },
  {
    slug: 'bounce', title: 'Wall to wall', concept: 'A variable can remember something between ticks. Use global so a function can change it.',
    goal: 'Coins land in a pattern that matches a sweeper that bounces from wall to wall.',
    story: 'Today the coins fall right where a bouncing robot would be. I only need to remember which way I’m going.',
    teach: {title: 'Remembering with global', text: 'A variable made inside a function is forgotten when the function ends. To remember something from tick to tick, make the variable outside every function, and write global before changing it inside. Here direction stays 1 or -1 between ticks.', code: 'direction = 1\n\ndef on_tick():\n    global direction\n    if player_x() == 8:\n        direction = -1\n    move_player(direction)'},
    playerX: 0, ticks: 40, target: 12, tools: ['global', 'tick', 'px', 'if', 'move'],
    spawns: Array.from({length: 12}, (_, i) => [i * 3, sweep[i * 3 + 5], 'coin']),
    testKeys: null,
    starter: 'direction = 1\n\ndef on_tick():\n    global direction\n    if player_x() == 8:\n        direction = -1\n    move_player(direction)\n',
    hints: ['Bit turns around at the right wall, but never turns back at the left wall.', 'Add a second if: when player_x() == 0, set direction = 1.'],
    idea: {label: 'Remember a value with global', needs: ['global']}, lines: 9,
    solution: 'direction = 1\n\ndef on_tick():\n    global direction\n    if player_x() == 8:\n        direction = -1\n    if player_x() == 0:\n        direction = 1\n    move_player(direction)',
  },
  {
    slug: 'helpers', title: 'Helper functions', concept: 'Move repeated steps into a function with a parameter, so on_tick reads like a plan.',
    goal: 'Write a go_to(x) helper, then use it to chase the coins.',
    story: 'My autopilot is getting long. If I teach myself a go_to command, my plan will fit in two lines.',
    teach: {title: 'Your own helper', text: 'A function can take a parameter and be called from other functions. go_to(x) slides one step toward column x. on_tick then only has to say where to go.', code: 'def go_to(x):\n    if x > player_x():\n        move_player(1)\n\ngo_to(5)'},
    playerX: 4, ticks: 34, target: 4, tools: ['def', 'tick', 'coin', 'px', 'if', 'move'],
    spawns: [[0, 1, 'coin'], [3, 4, 'rock'], [8, 7, 'coin'], [11, 4, 'rock'], [16, 1, 'coin'], [19, 4, 'rock'], [24, 7, 'coin']],
    testKeys: null,
    starter: 'def go_to(x):\n    if x > player_x():\n        move_player(1)\n\ndef on_tick():\n    if coin_x() >= 0:\n        go_to(coin_x())\n',
    hints: ['go_to only knows how to slide right. Rocks are falling on Bit’s starting column, so Bit must keep moving.', 'Add an elif to go_to that slides left when x < player_x().'],
    idea: {label: 'Define and call your own function', needs: ['def', 'param']}, lines: 10,
    solution: 'def go_to(x):\n    if x > player_x():\n        move_player(1)\n    elif x < player_x():\n        move_player(-1)\n\ndef on_tick():\n    if coin_x() >= 0:\n        go_to(coin_x())',
  },
  {
    slug: 'free-play', title: 'Your game, your rules', concept: 'Combine events, the game clock, variables, and helpers into a game you can play yourself or hand over to an autopilot.',
    goal: 'Coins and rocks both fall. Score 8 points and keep at least one life, playing live or with code.',
    story: 'Rocks! Catching a coin scores a point, but catching a rock costs a life. Play it yourself with the arrow keys, or write code that does it for you.',
    teach: {title: 'Make it yours', text: 'Press Play to use the arrow keys live. Use on_key for your own controls, on_tick for an autopilot, and say() to show messages. rock_x() tells you where the lowest rock is. Try mixing them!', code: 'def on_key(key):\n    if key == "left":\n        move_player(-1)\n    if key == "right":\n        move_player(1)'},
    playerX: 4, ticks: 60, target: 8, tools: ['key', 'tick', 'coin', 'rock', 'px', 'if', 'move', 'say', 'def', 'global'],
    spawns: freePlay(), testKeys: null, sandbox: true,
    starter: 'def on_key(key):\n    if key == "left":\n        move_player(-1)\n    if key == "right":\n        move_player(1)\n',
    hints: ['Press Play live and use the left and right arrow keys, or the on-screen buttons.', 'Try an autopilot: chase coin_x() like in the earlier missions, and step away when rock_x() is in your column.'],
    idea: {label: 'Use on_key or on_tick', needs: ['def']}, lines: 30,
    solution: 'def go_to(x):\n    if x > player_x():\n        move_player(1)\n    elif x < player_x():\n        move_player(-1)\n\ndef on_tick():\n    if coin_x() >= 0:\n        go_to(coin_x())',
  },
];
missions.forEach((mission, index) => { mission.index = index; });
export const missionBySlug = slug => missions.find(m => m.slug === slug);

/**
 * Start a game with the player's program. Returns a match: call match.step(key) once per tick.
 * status: 'running', 'won', 'lost' (no lives), 'incomplete' (time ran out), or 'error'.
 */
export function createMatch(mission, source) {
  const match = {
    status: 'running', error: null, features: new Set(), lines: 0, tick: 0, frames: [],
    state: {px: mission.playerX ?? 4, items: [], score: 0, lives: 3, said: ''},
  };
  const state = match.state;
  const fail = error => {
    match.status = 'error';
    match.error = error instanceof QuestError ? {line: error.line, message: error.message, kind: error.kind}
      : {line: 0, message: 'This program is nested too deeply for Bit to follow.', kind: 'limit'};
  };
  const lowest = kind => state.items.filter(item => item.kind === kind).sort((a, b) => b.y - a.y)[0];
  const noArgs = (name, args, line) => { if (args.length) throw new QuestError(`${name}() doesn’t need anything inside its parentheses.`, line); };
  const commands = {
    move_player(args, line) {
      if (args.length !== 1) throw new QuestError('move_player() needs one number: -1 slides left and 1 slides right.', line);
      if (typeof args[0] !== 'number' || !Number.isInteger(args[0])) throw new QuestError('move_player() needs a whole number, like move_player(-1).', line);
      state.px = Math.min(W - 1, Math.max(0, state.px + Math.max(-W, Math.min(W, args[0]))));
      return null;
    },
    player_x(args, line) { noArgs('player_x', args, line); return state.px; },
    coin_x(args, line) { noArgs('coin_x', args, line); return lowest('coin')?.x ?? -1; },
    rock_x(args, line) { noArgs('rock_x', args, line); return lowest('rock')?.x ?? -1; },
    score(args, line) { noArgs('score', args, line); return state.score; },
    lives(args, line) { noArgs('lives', args, line); return state.lives; },
    say(args, line) { state.said = args.map(a => (typeof a === 'string' ? a : String(a))).join(' ').slice(0, 60); return null; },
  };

  let runtime = null;
  try {
    const program = parse(source);
    match.features = program.features;
    match.lines = program.lines;
    runtime = execute(program, {commands, print: text => { state.said = String(text).slice(0, 60); }, maxSteps: 5000});
  } catch (error) {
    if (!(error instanceof QuestError) && !(error instanceof RangeError)) throw error;
    fail(error);
  }

  const snapshot = (events = {}) => ({tick: match.tick, px: state.px, items: state.items.map(i => ({...i})), score: state.score, lives: state.lives, said: state.said, ...events});
  match.frames.push(snapshot());

  match.step = (key = null) => {
    if (match.status !== 'running') return null;
    const events = {caught: [], hit: [], missed: []};
    state.said = '';
    for (const [at, x, kind] of mission.spawns) if (at === match.tick && state.items.length < MAX_ITEMS) state.items.push({x, y: 0, kind});
    try {
      if (runtime && key && runtime.has('on_key')) runtime.call('on_key', [key]);
      if (runtime && runtime.has('on_tick')) runtime.call('on_tick');
    } catch (error) {
      if (!(error instanceof QuestError) && !(error instanceof RangeError)) throw error;
      fail(error);
    }
    for (const item of state.items) item.y++;
    state.items = state.items.filter(item => {
      if (item.y >= PLAYER_Y && item.x === state.px) {
        if (item.kind === 'coin') { state.score++; events.caught.push(item.x); } else { state.lives--; events.hit.push(item.x); }
        return false;
      }
      if (item.y >= H) { if (item.kind === 'coin') events.missed.push(item.x); return false; }
      return true;
    });
    match.tick++;
    if (match.status === 'running') {
      if (state.lives <= 0) match.status = 'lost';
      else if (state.score >= mission.target) match.status = 'won';
      else if (match.tick >= mission.ticks) match.status = 'incomplete';
    }
    const frame = snapshot(events);
    match.frames.push(frame);
    return frame;
  };
  return match;
}

/** Play a whole game with scripted keys (the mission's test keys unless told otherwise). */
export function playAll(mission, source, keys = mission.testKeys) {
  const match = createMatch(mission, source);
  while (match.status === 'running') match.step(keys?.[match.tick] ?? null);
  return match;
}

/** Judge a program for a mission and work out its stars. */
export function judgeGame(mission, source) {
  const match = playAll(mission, source);
  const solved = match.status === 'won';
  const idea = solved && (mission.idea?.needs || []).every(feature => match.features.has(feature));
  const short = solved && match.lines <= mission.lines;
  return {match, solved, goals: {solved, idea, short}, stars: solved ? 1 + Number(idea) + Number(short) : 0, lines: match.lines};
}
