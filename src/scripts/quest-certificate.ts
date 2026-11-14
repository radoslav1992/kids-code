// Fills in the certificate from this browser's saved stars, and saves a progress file.
import {readStars} from '../lib/quest/stars';
import {makeReport, summarize, cleanName} from '../lib/quest/report.mjs';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const nameInput = $<HTMLInputElement>('cert-name');

function render() {
  const report = makeReport(nameInput.value, readStars());
  const summary = summarize(report);
  $('cert-display-name').textContent = report.name || 'A Brilliant Coder';
  $('cert-done').textContent = String(summary.done);
  $('cert-stars').textContent = String(summary.stars);
  $('cert-complete').hidden = !summary.complete;
  $('cert-empty').hidden = summary.done > 0;
  summary.rows.forEach(row => {
    const item = document.querySelector(`#cert-worlds [data-world="${row.id}"] b`);
    if (item) item.textContent = `${row.stars} / ${row.max}`;
  });
  $('cert-date').textContent = new Date().toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'});
}

nameInput.addEventListener('input', render);
$('cert-print').addEventListener('click', () => window.print());
$('cert-save').addEventListener('click', () => {
  const report = makeReport(cleanName(nameInput.value), readStars());
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], {type: 'application/json'}));
  const a = document.createElement('a');
  a.href = url;
  a.download = `code-quest-${(report.name || 'progress').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'progress'}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener('quest-stars', render);
render();
