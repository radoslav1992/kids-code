import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {parse, execute} from '../src/lib/quest/lang.mjs';
import {missions, TOOLS, createMatch, playAll, judgeGame, W, H} from '../src/lib/quest/gamelab.mjs';

test('Game Lab has 5 missions with unique slugs and valid tools', () => {
  assert.equal(missions.length, 5);
  assert.equal(new Set(missions.map(m => m.slug)).size, 5);
  for (const m of missions) {
    for (const tool of m.tools) assert.ok(TOOLS[tool], `${m.slug}: ${tool}`);
    assert.ok(m.hints.length >= 2 && m.story.length > 40 && m.concept.length > 40);
    for (const [tick, x, kind] of m.spawns) {
      assert.ok(Number.isInteger(tick) && tick >= 0 && tick < m.ticks);
      assert.ok(x >= 0 && x < W);
      assert.ok(kind === 'coin' || kind === 'rock');
    }
  }
});

for (const mission of missions) {
  test(`Game Lab ${mission.slug}: solution parses as Python`, () => {
    const check = spawnSync('python3', ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'], {input: [mission.solution, mission.starter, mission.teach.code].join('\n'), encoding: 'utf8'});
    assert.equal(check.status, 0, check.stderr);
  });
  if (mission.sandbox) {
    test(`Game Lab ${mission.slug}: free play runs to a fair end without errors`, () => {
      for (const source of [mission.starter, mission.solution, '']) {
        const match = playAll(mission, source);
        assert.notEqual(match.status, 'error', source);
        assert.ok(['won', 'lost', 'incomplete'].includes(match.status));
        assert.ok(match.frames.length <= mission.ticks + 1);
      }
      // Standing still must not win, and a human holding left cannot lose time without a result.
      assert.notEqual(playAll(mission, '').status, 'won');
    });
    continue;
  }
  test(`Game Lab ${mission.slug}: solution earns 3 stars and the starter does not win`, () => {
    const verdict = judgeGame(mission, mission.solution);
    assert.equal(verdict.match.status, 'won', JSON.stringify(verdict.match.error));
    assert.deepEqual(verdict.goals, {solved: true, idea: true, short: true});
    assert.equal(verdict.stars, 3);
    const starter = judgeGame(mission, mission.starter);
    assert.equal(starter.solved, false);
    assert.equal(starter.stars, 0);
    assert.notEqual(starter.match.status, 'error');
    assert.equal(judgeGame(mission, '').solved, false);
  });
}

test('Falling items: catching, missing, rocks, and lives', () => {
  const mission = {playerX: 2, ticks: 20, target: 99, spawns: [[0, 2, 'coin'], [1, 5, 'coin'], [2, 2, 'rock'], [3, 2, 'rock'], [4, 2, 'rock']]};
  const match = playAll(mission, '');
  assert.equal(match.state.score, 1);
  assert.equal(match.state.lives, 0);
  assert.equal(match.status, 'lost');
  assert.deepEqual(match.frames.find(f => f.caught?.length).caught, [2]);
  assert.equal(match.frames.find(f => f.caught?.length).tick, H - 1, 'a coin lands six ticks after it appears');
  assert.ok(match.frames.some(f => f.missed?.includes(5)));
  assert.ok(match.frames.some(f => f.hit?.length));
});

test('A coin can still be caught on the tick after it lands', () => {
  const mission = {playerX: 0, ticks: 12, target: 1, spawns: [[0, 1, 'coin']]};
  const match = createMatch(mission, 'def on_tick():\n    if coin_x() >= 0 and player_x() != coin_x():\n        if tick_late:\n            move_player(1)\n');
  match.step();
  assert.equal(match.status, 'error', 'unknown names are reported when the tick runs');
  assert.match(match.error.message, /doesn’t know "tick_late"/);
  const late = createMatch(mission, 'later = 0\ndef on_tick():\n    global later\n    later += 1\n    if later == 7:\n        move_player(1)\n');
  while (late.status === 'running') late.step();
  assert.equal(late.status, 'won');
});

test('Game commands, messages, and friendly errors', () => {
  const mission = {playerX: 4, ticks: 3, target: 99, spawns: []};
  let match = createMatch(mission, 'def on_tick():\n    move_player(3)\n    say("x =", player_x(), "score", score(), lives())');
  match.step();
  assert.equal(match.state.px, 7);
  assert.equal(match.frames.at(-1).said, 'x = 7 score 0 3');
  match.step(); match.step();
  assert.equal(match.state.px, 8, 'Bit stops at the wall');
  assert.equal(match.status, 'incomplete');
  assert.equal(match.step(), null, 'a finished match stays finished');
  for (const [code, pattern] of [['move_player()', /needs one number/], ['move_player(1.5)', /whole number/], ['move_player("a")', /whole number/], ['player_x(3)', /doesn’t need/]]) {
    match = createMatch(mission, 'def on_tick():\n    ' + code);
    match.step();
    assert.equal(match.status, 'error', code);
    assert.match(match.error.message, pattern);
    assert.equal(match.error.line, 2);
  }
  match = createMatch(mission, 'def on_key(key):\n    pass\ndef on_tick():\n    while True:\n        pass');
  match.step();
  assert.equal(match.error.kind, 'limit');
  match = createMatch(mission, 'move(');
  assert.equal(match.status, 'error');
  assert.equal(match.error.kind, 'syntax');
  match = createMatch(mission, 'say("setup runs once")');
  assert.equal(match.status, 'running');
});

test('global works in the interpreter and matches Python', () => {
  const programs = [
    'n = 0\ndef bump():\n    global n\n    n += 2\nbump()\nbump()\nprint(n)',
    'n = 5\ndef shadow():\n    n = 1\n    return n\nprint(shadow(), n)',
    'a = 1\nb = 1\ndef swap():\n    global a, b\n    a = 7\n    b = 8\nswap()\nprint(a, b)',
  ];
  for (const source of programs) {
    const lines = [];
    execute(parse(source), {print: text => lines.push(text)});
    const python = spawnSync('python3', ['-c', source], {encoding: 'utf8'});
    assert.equal(lines.join('\n'), python.stdout.trimEnd(), source);
  }
  assert.throws(() => parse('global x'), /inside a function/);
  assert.throws(() => parse('def f():\n    global\n    pass'), /variable name/);
  assert.ok(parse('def f():\n    global x\n    x = 1').features.has('global'));
  const lines = [];
  const run = execute(parse('count = 0\ndef tick():\n    global count\n    count += 1\n    print(count)\n'), {print: t => lines.push(t)});
  assert.equal(run.has('tick'), true);
  assert.equal(run.has('nope'), false);
  run.call('tick'); run.call('tick');
  assert.deepEqual(lines, ['1', '2']);
});
