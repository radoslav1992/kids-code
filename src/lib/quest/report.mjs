// Progress files and class reports. Everything happens in the browser: a student downloads a small
// JSON file, and a teacher opens several of them to see a class table. Nothing is uploaded.
import {levels, worlds} from './levels.mjs';
import {missions} from './gamelab.mjs';

export const FORMAT = 'kidscode-quest';
export const VERSION = 1;
export const MAX_FILE_BYTES = 20000;
export const MAX_NAME = 40;

/** Every slug a progress file may contain. Game Lab slugs are stored with a "lab-" prefix. */
export const knownSlugs = new Set([...levels.map(l => l.slug), ...missions.map(m => 'lab-' + m.slug)]);
export const MAX_REPORT_STARS = (levels.length + missions.length) * 3;

export function cleanName(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
}

export function makeReport(name, stars, now = new Date()) {
  const clean = {};
  for (const [slug, value] of Object.entries(stars || {})) {
    if (knownSlugs.has(slug) && Number.isInteger(value) && value >= 1 && value <= 3) clean[slug] = value;
  }
  return {format: FORMAT, version: VERSION, name: cleanName(name), saved: now.toISOString().slice(0, 10), stars: clean};
}

/** Read a progress file. Returns a clean report, or null if it is not one of ours. */
export function parseReport(text) {
  if (typeof text !== 'string' || text.length > MAX_FILE_BYTES) return null;
  let data;
  try { data = JSON.parse(text); } catch { return null; }
  if (!data || typeof data !== 'object' || data.format !== FORMAT || data.version !== VERSION) return null;
  if (!data.stars || typeof data.stars !== 'object' || Array.isArray(data.stars)) return null;
  const report = makeReport(data.name, data.stars, new Date(0));
  report.saved = typeof data.saved === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.saved) ? data.saved : '';
  return report;
}

const sum = (slugs, stars) => slugs.reduce((total, slug) => total + (stars[slug] || 0), 0);

/** Stars per world, plus Game Lab and overall totals. */
export function summarize(report) {
  const rows = worlds.map(world => {
    const slugs = world.levels.map(l => l.slug);
    return {id: world.id, name: world.name, stars: sum(slugs, report.stars), max: slugs.length * 3, done: slugs.filter(s => report.stars[s]).length, total: slugs.length};
  });
  const lab = missions.map(m => 'lab-' + m.slug);
  rows.push({id: 'game-lab', name: 'Game Lab', stars: sum(lab, report.stars), max: lab.length * 3, done: lab.filter(s => report.stars[s]).length, total: lab.length});
  const stars = rows.reduce((t, r) => t + r.stars, 0);
  const done = rows.reduce((t, r) => t + r.done, 0);
  return {rows, stars, done, max: MAX_REPORT_STARS, total: levels.length + missions.length, complete: done === levels.length + missions.length};
}

/** A spreadsheet cell that cannot be run as a formula. */
export function safeCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export function classCsv(reports) {
  const head = ['Name', 'Saved', ...worlds.map(w => w.name + ' stars'), 'Game Lab stars', 'Levels done', 'Total stars'];
  const lines = [head.map(safeCell).join(',')];
  for (const report of reports) {
    const s = summarize(report);
    lines.push([report.name || 'Unnamed', report.saved, ...s.rows.map(r => r.stars), s.done, s.stars].map(safeCell).join(','));
  }
  return lines.join('\n') + '\n';
}
