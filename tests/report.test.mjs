import test from 'node:test';
import assert from 'node:assert/strict';
import {makeReport, parseReport, summarize, classCsv, safeCell, cleanName, knownSlugs, MAX_REPORT_STARS, MAX_FILE_BYTES} from '../src/lib/quest/report.mjs';
import {levels, worlds} from '../src/lib/quest/levels.mjs';
import {missions} from '../src/lib/quest/gamelab.mjs';

test('Reports keep only known levels with 1 to 3 stars', () => {
  const report = makeReport('  Ada  Lovelace <b> ', {'first-steps': 3, 'lab-slide': 2, 'nonsense': 3, 'move-it': 2, 'count-your-steps': 4, 'turn-left': 0, 'turn-right': 1.5, 'the-comb': '3'}, new Date('2026-11-14T10:00:00Z'));
  assert.deepEqual(report.stars, {'first-steps': 3, 'lab-slide': 2});
  assert.equal(report.name, 'Ada Lovelace b');
  assert.equal(report.saved, '2026-11-14');
  assert.equal(MAX_REPORT_STARS, (30 + 5) * 3);
  assert.equal(knownSlugs.size, 35);
});

test('Reports round-trip and reject anything that is not ours', () => {
  const report = makeReport('Sam', {'first-steps': 2, 'the-lighthouse': 3}, new Date('2026-01-02T00:00:00Z'));
  assert.deepEqual(parseReport(JSON.stringify(report)), report);
  const bad = ['', 'not json', '[]', 'null', '{}', JSON.stringify({...report, format: 'other'}), JSON.stringify({...report, version: 2}), JSON.stringify({...report, stars: []}), JSON.stringify({...report, stars: 'x'}), 'x'.repeat(MAX_FILE_BYTES + 1), null, 5];
  for (const text of bad) assert.equal(parseReport(text), null, String(text).slice(0, 30));
  const hostile = parseReport(JSON.stringify({format: 'kidscode-quest', version: 1, name: '<img src=x onerror=alert(1)>'.repeat(5), saved: 'yesterday', stars: {'__proto__': 3, 'first-steps': 9, 'turn-left': 2}}));
  assert.deepEqual(hostile.stars, {'turn-left': 2});
  assert.ok(hostile.name.length <= 40 && !/[<>]/.test(hostile.name));
  assert.equal(hostile.saved, '');
});

test('Summaries count stars per world and for Game Lab', () => {
  const stars = {};
  for (const level of worlds[0].levels) stars[level.slug] = 3;
  stars['count-and-climb'] = 1;
  stars['lab-autopilot'] = 2;
  const summary = summarize(makeReport('x', stars));
  assert.equal(summary.rows.length, 7);
  assert.deepEqual(summary.rows[0], {id: 'meadow', name: 'Launch Meadow', stars: 15, max: 15, done: 5, total: 5});
  assert.equal(summary.rows[4].stars, 1);
  assert.equal(summary.rows[6].name, 'Game Lab');
  assert.equal(summary.rows[6].stars, 2);
  assert.equal(summary.stars, 18);
  assert.equal(summary.done, 7);
  assert.equal(summary.complete, false);
  const all = Object.fromEntries([...levels.map(l => l.slug), ...missions.map(m => 'lab-' + m.slug)].map(s => [s, 3]));
  const full = summarize(makeReport('x', all));
  assert.equal(full.complete, true);
  assert.equal(full.stars, MAX_REPORT_STARS);
});

test('Class CSV is a valid table and safe to open in a spreadsheet', () => {
  assert.equal(safeCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(safeCell('+1'), "'+1");
  assert.equal(safeCell('-2'), "'-2");
  assert.equal(safeCell('@sum'), "'@sum");
  assert.equal(safeCell('Lee, Jo'), '"Lee, Jo"');
  assert.equal(safeCell(7), '7');
  assert.equal(cleanName('a\u0000b\nc'), 'a b c');
  const csv = classCsv([makeReport('=cmd', {'first-steps': 3}, new Date('2026-05-05T00:00:00Z')), makeReport('', {})]);
  const rows = csv.trimEnd().split('\n');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].split(',').length, 2 + 6 + 1 + 2);
  assert.ok(rows[1].startsWith("'=cmd,2026-05-05,3,0,0,0,0,0,0,1,3"), rows[1]);
  assert.ok(rows[2].startsWith('Unnamed,'));
});
