import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {parse, execute, countLines, QuestError} from '../src/lib/quest/lang.mjs';
import {levels, worlds, TOOLS, MAX_STARS} from '../src/lib/quest/levels.mjs';
import {judge, runProgram, layoutFor, parseMap, variantCount, encodeShare, decodeShare, describeLayout, MAX_ACTIONS} from '../src/lib/quest/world.mjs';

/** Run a program with print() captured, the way the Python comparison below needs it. */
function output(source) {
  const lines = [];
  execute(parse(source), {print: text => lines.push(text)});
  return lines.join('\n');
}
function errorOf(source) {
  const run = runProgram(layoutFor({map: ['>......*']}), source);
  assert.equal(run.status, 'error', 'Expected an error from: ' + source);
  return run.error;
}

test('Code Quest has 6 worlds of 5 levels with unique slugs', () => {
  assert.equal(worlds.length, 6);
  for (const world of worlds) assert.equal(world.levels.length, 5, world.name);
  assert.equal(levels.length, 30);
  assert.equal(MAX_STARS, 90);
  assert.equal(new Set(levels.map(l => l.slug)).size, levels.length);
  for (const level of levels) {
    assert.match(level.slug, /^[a-z][a-z-]+$/);
    assert.ok(!['builder', 'guide'].includes(level.slug));
    for (const tool of level.tools) assert.ok(TOOLS[tool], `${level.slug}: unknown tool ${tool}`);
    assert.ok(level.hints.length >= 2 && level.story.length > 40 && level.concept.length > 40 && level.teach.text.length > 40, level.slug);
  }
});

for (const level of levels) {
  test(`Quest ${level.worldId} ${level.number} (${level.slug}): solution earns 3 stars on every layout`, () => {
    for (let k = 0; k < variantCount(level); k++) {
      const layout = layoutFor(level, k);
      assert.ok(layout.crystals.length > 0, 'has crystals');
      assert.ok(describeLayout(layout).length > 40);
      const verdict = judge(level, level.solution, k);
      assert.equal(verdict.result.status, 'win', JSON.stringify(verdict.result.error) + '\n' + layout.tiles.map(r => r.join(',')).join('\n'));
      assert.equal(verdict.variant, k);
      assert.deepEqual(verdict.goals, {solved: true, idea: true, short: true});
      assert.equal(verdict.stars, 3);
    }
    assert.equal(countLines(level.solution), judge(level, level.solution).lines);
    assert.ok(countLines(level.solution) <= level.lines);
  });
  test(`Quest ${level.slug}: starter code is readable but does not solve the level`, () => {
    const verdict = judge(level, level.starter);
    assert.equal(verdict.solved, false);
    assert.equal(verdict.stars, 0);
    if (level.starter.trim()) assert.notEqual(verdict.result.error?.kind, 'syntax', verdict.result.error?.message);
    else assert.equal(verdict.result.status, 'empty');
  });
  test(`Quest ${level.slug}: teaching example is valid code`, () => {
    assert.doesNotThrow(() => parse(level.teach.code));
  });
}

test('Levels that change between runs cannot be passed by memorising one layout', () => {
  const changing = levels.filter(level => variantCount(level) > 1);
  assert.ok(changing.length >= 12);
  for (const level of changing) {
    // Replay the exact moves that win layout 0 as a fixed script.
    const first = runProgram(layoutFor(level, 0), level.solution);
    const script = first.events.filter(e => e.type === 'move' || e.type === 'turn').map(e => e.type === 'move' ? 'move()' : e.by === -1 ? 'turn_left()' : e.by === 1 ? 'turn_right()' : 'turn_around()').join('\n');
    assert.equal(runProgram(layoutFor(level, 0), script).status, 'win', level.slug);
    const verdict = judge(level, script, 0);
    assert.equal(verdict.solved, false, level.slug);
    assert.equal(verdict.stars, 0);
    assert.equal(verdict.lucky, true, level.slug);
    assert.notEqual(verdict.variant, 0);
  }
});

test('Stars: solving, using the idea, and short code are separate goals', () => {
  const pond = levels.find(l => l.slug === 'round-the-pond');
  const long = 'move(3)\nturn_left()\nmove(3)\nturn_left()\nmove(3)';
  assert.deepEqual(judge(pond, long).goals, {solved: true, idea: false, short: false});
  assert.equal(judge(pond, long).stars, 1);
  const loopy = 'for i in range(3):\n    move()\n    move()\n    move()\n    turn_left()';
  assert.deepEqual(judge(pond, loopy).goals, {solved: true, idea: true, short: false});
  assert.equal(judge(pond, loopy).stars, 2);
  assert.equal(judge(pond, '# comments and blank lines are free\n\n' + pond.solution + '\n\n').stars, 3);
});

test('Game rules: crystals, rocks, water, and stopping at the win', () => {
  const board = {map: ['>.*#', '    ']};
  assert.equal(runProgram(layoutFor(board), 'move()').status, 'incomplete');
  assert.equal(runProgram(layoutFor(board), '').status, 'empty');
  assert.equal(runProgram(layoutFor(board), '# just a note').status, 'empty');
  const win = runProgram(layoutFor(board), 'move(2)\nmove(5)');
  assert.equal(win.status, 'win');
  assert.equal(win.events.length, 2, 'the run stops when the last crystal is collected');
  assert.equal(win.events[1].got, 0);
  const rock = runProgram(layoutFor({map: ['>#*']}), 'move(2)');
  assert.equal(rock.status, 'crash');
  assert.equal(rock.events.at(-1).type, 'bump');
  assert.equal(rock.error.line, 1);
  const water = runProgram(layoutFor(board), 'turn_right()\nmove()');
  assert.equal(water.status, 'crash');
  assert.equal(water.events.at(-1).type, 'splash');
  assert.equal(water.error.line, 2);
  const edge = runProgram(layoutFor(board), 'turn_around()\nmove()');
  assert.equal(edge.status, 'crash', 'the edge of the board counts as water');
  assert.equal(runProgram(layoutFor(board), 'move(0)\nmove(1.5)').error.kind, 'runtime');
  assert.equal(runProgram(layoutFor(board), 'move(-1)').status, 'error');
  assert.equal(runProgram(layoutFor(board), 'move("2")').status, 'error');
  assert.equal(runProgram(layoutFor(board), 'turn_left(1)').status, 'error');
});

test('Sensors, signs, maps, and say', () => {
  const layout = layoutFor({map: ['>ob#', '   *'], signs: [{x: 0, y: 0, value: 7}], scroll: [1, 'left']});
  const run = runProgram(layout, 'say(read_sign(), tile_color(), path_clear(), crystals_left())\nmove()\nsay(tile_color())\nmove()\nsay(tile_color(), path_clear())\nm = read_map()\nm.append(3)\nsay(read_map())');
  assert.equal(run.status, 'incomplete');
  assert.deepEqual(run.events.filter(e => e.type === 'say').map(e => e.text), ['7 plain True 1', 'orange', 'blue False', "[1, 'left']"]);
  assert.equal(run.events.find(e => e.type === 'read').value, 7);
  assert.match(runProgram(layout, 'move()\nread_sign()').error.message, /no sign/);
  assert.match(runProgram(layoutFor({map: ['>*']}), 'read_map()').error.message, /treasure map/);
  assert.throws(() => layoutFor({map: ['>.#'], signs: [{x: 2, y: 0, value: 1}]}));
});

test('Runaway programs are stopped', () => {
  const layout = layoutFor({map: ['>.*']});
  const spin = runProgram(layout, 'while True:\n    turn_left()');
  assert.equal(spin.status, 'error');
  assert.equal(spin.error.kind, 'limit');
  assert.equal(spin.events.length, MAX_ACTIONS);
  assert.equal(runProgram(layout, 'while True:\n    pass').error.kind, 'limit');
  assert.equal(runProgram(layout, 'def f():\n    f()\nf()').error.kind, 'limit');
  assert.equal(runProgram(layout, 'x = [1]\nwhile True:\n    x = x + x').error.kind, 'limit');
  assert.equal(runProgram(layout, 'x = "ab"\nfor i in range(50):\n    x = x + x').error.kind, 'limit');
  assert.equal(runProgram(layout, 'x = 9 ** 9 ** 9').error.kind, 'limit');
  assert.equal(runProgram(layout, 'for i in range(999999999):\n    pass').error.kind, 'limit');
  assert.equal(runProgram(layout, 'x = ' + '('.repeat(3000) + '1' + ')'.repeat(3000)).status, 'error');
  assert.equal(runProgram(layout, 'move()\n'.repeat(5000)).error.kind, 'syntax', 'very long programs are refused');
});

test('Friendly errors point at the right line', () => {
  const cases = [
    ['move', 1, /add parentheses: move\(\)/],
    ['move 3', 1, /move\(3\)/],
    ['move()\nMove()', 2, /Did you mean move\? Capital letters/],
    ['turnLeft()', 1, /Did you mean turn_left/],
    ['forward()', 1, /Did you mean move/],
    ['mvoe()', 1, /Did you mean move/],
    ['for i in range(3)\n    move()', 1, /colon/],
    ['for i in range(3):\nmove()', 2, /indented/],
    ['for i in range(3):', 1, /at least one indented line/],
    ['move()\n    move()', 2, /indented, but/],
    ['if path_clear():\n    move()\n  move()', 3, /line up/],
    ['x = 3\nif x = 3:\n    move()', 2, /two equals signs/],
    ['else:\n    move()', 1, /matching "if"/],
    ['if True:\n    pass\nelse if True:\n    pass', 3, /elif/],
    ['move(', 1, /never closed/],
    ['move())', 1, /closing bracket/],
    ['say("hi)', 1, /closing quote/],
    ['move();', 1, /doesn’t need a ;/],
    ['x = 1 +', 1, /stops too soon/],
    ['3 = x', 1, /left side of =/],
    ['break', 1, /inside a loop/],
    ['return 3', 1, /inside a function/],
    ['for i in 5:\n    pass', 1, /range\(5\)/],
    ['x = [1, 2]\nsay(x[2])', 2, /indexes go from 0 to 1/],
    ['say(1 + "a")', 1, /str\(\)/],
    ['say(1 / 0)', 1, /divide by zero/],
    ['def hop(n):\n    pass\nhop()', 3, /needs 1 value/],
    ['x = 3\nx()', 2, /Only commands/],
    ['say(y)', 1, /doesn’t know "y"/],
    ['2x = 3', 1, /start with a letter/],
    ['if x {', 1, /braces/],
  ];
  for (const [source, line, pattern] of cases) {
    const error = errorOf(source);
    assert.equal(error.line, line, source);
    assert.match(error.message, pattern, source);
  }
});

test('The language matches real Python on a set of programs', () => {
  const programs = [
    'print(1 + 2 * 3, 7 // 2, -7 // 2, 7 % 3, -7 % 3, 2 ** 10, 10 - 4 - 3)',
    'print(3 > 2, 2 >= 2, 1 == 1, 1 != 1, "a" < "b", not True, True and False, True or False)',
    'x = 5\nx += 2\nx *= 3\nx -= 1\nprint(x)',
    'total = 0\nfor i in range(5):\n    total = total + i\nprint(total)',
    'for i in range(2, 11, 3):\n    print(i)\nfor i in range(3, 0, -1):\n    print(i)',
    'n = 0\nwhile n < 10:\n    n += 3\n    if n == 6:\n        continue\n    if n > 8:\n        break\n    print(n)\nprint("done", n)',
    'def add(a, b):\n    return a + b\ndef twice(n):\n    return add(n, n)\nprint(twice(4), add("ab", "cd"))',
    'def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)\nprint(fact(6))',
    'def nothing():\n    pass\nprint(nothing())',
    'items = [3, "left", 2.5, True, None, [1, 2]]\nprint(items)\nprint(len(items), items[0], items[-1], items[1])',
    'a = [1, 2]\na.append(3)\nb = a\nb[0] = 9\nprint(a, a.pop(), a, a + [7], [0] * 3)',
    'for word in ["left", "right"]:\n    if word == "left":\n        print("L")\n    elif word == "right":\n        print("R")\n    else:\n        print("?")',
    'print("ab" * 3, "a" + "b", "x" in "xyz", 2 in [1, 2], 3 not in [1, 2], len("hello"))',
    'print(str(12) + "!", int("42") + 1, int(3.9), abs(-4), min(3, 1, 2), max([4, 9, 2]))',
    'x = 10\ndef f():\n    x = 3\n    return x\nprint(f(), x)',
    'for a in range(3):\n    for b in range(2):\n        if a == b: print(a, b)',
    'print(1 < 2 and "yes", 0 or "fallback", [] or "empty", not 0)',
    'for c in "hey":\n    print(c)',
    'i = 0\nfor i in range(3):\n    pass\nprint(i)',
    'print(2 * 3 + 4 * 5 - 6 // 4 % 2, (2 + 3) * 4, -2 ** 2, 10 / 4)',
    'def loop():\n    for i in range(10):\n        if i == 3:\n            return i\nprint(loop())',
    'print(1 == True, [1, [2, 3]] == [1, [2, 3]], "1" == 1)',
  ];
  for (const source of programs) {
    const python = spawnSync('python3', ['-c', source], {encoding: 'utf8', timeout: 5000});
    assert.equal(python.status, 0, python.stderr);
    assert.equal(output(source), python.stdout.replace(/\n$/, ''), source);
  }
});

test('Curly quotes typed by tablets are accepted', () => {
  assert.equal(output('print("it’s", “curly” == "curly", ‘a’ + \'b\')'), 'it’s True ab');
  assert.throws(() => parse('say("unclosed’)'), QuestError);
});

test('Every level solution is also valid Python syntax', () => {
  for (const level of levels) {
    const check = spawnSync('python3', ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'], {input: level.solution + '\n' + level.starter + '\n' + level.teach.code, encoding: 'utf8', timeout: 5000});
    assert.equal(check.status, 0, level.slug + ': ' + check.stderr);
  }
});

test('Program features are detected for the idea star', () => {
  const features = source => [...parse(source).features].sort();
  assert.deepEqual(features('move()'), ['call:move']);
  assert.deepEqual(features('move(2)'), ['arg:move', 'call:move']);
  assert.ok(features('for i in range(2):\n    for j in range(2):\n        pass').includes('nested-for'));
  assert.ok(!features('for i in range(2):\n    pass\nfor j in range(2):\n    pass').includes('nested-for'));
  assert.ok(!features('def f():\n    for j in range(2):\n        pass\nfor i in range(2):\n    f()').includes('nested-for'));
  assert.deepEqual(features('def f(n):\n    return n'), ['def', 'param', 'return']);
  assert.deepEqual(features('x = [1]\nx[0] = 2'), ['assign', 'index', 'list']);
  assert.deepEqual(features('if True:\n    pass\nelif False:\n    pass\nelse:\n    pass\nwhile False:\n    pass'), ['elif', 'else', 'if', 'while']);
  assert.equal(countLines('# note\n\nmove()  # go\n   \n  # another\nmove()'), 2);
});

test('Maps are validated', () => {
  assert.throws(() => parseMap([]));
  assert.throws(() => parseMap(['..*']), /starting place/);
  assert.throws(() => parseMap(['>>*']), /one starting place/);
  assert.throws(() => parseMap(['>x*']), /Unknown/);
  assert.throws(() => parseMap(['>' + '.'.repeat(20)]));
  const board = parseMap(['v.', '*O#']);
  assert.deepEqual(board.start, {x: 0, y: 0, dir: 2});
  assert.deepEqual(board.crystals, [{x: 0, y: 1}, {x: 1, y: 1}]);
  assert.deepEqual(board.tiles, [['floor', 'floor', 'water'], ['floor', 'orange', 'rock']]);
});

test('Shared builder levels round-trip and reject anything unexpected', () => {
  for (const level of levels) {
    for (let k = 0; k < variantCount(level); k++) {
      const layout = layoutFor(level, k);
      if (layout.w > 10 || layout.h > 8) continue;
      const code = encodeShare(layout);
      assert.match(code, /^[-frobcnesw.]+$/);
      const again = parseMap(decodeShare(code));
      assert.deepEqual(again.tiles, layout.tiles);
      assert.deepEqual(again.start, layout.start);
      assert.deepEqual(again.crystals, layout.crystals);
    }
  }
  for (const bad of ['', 'fff', 'eff', 'ecc.ecc', 'e<script>c', 'ec'.repeat(60), 'e.c.f.f.f.f.f.f.f', 'efc..f', 'efffffffffc', null, 42, {}]) assert.equal(decodeShare(bad), null, String(bad));
  assert.deepEqual(decodeShare('ef-c'), ['>. *']);
});
