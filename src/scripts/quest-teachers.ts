// Class progress table: reads student progress files in the browser. Nothing is uploaded.
import {parseReport, summarize, classCsv, MAX_FILE_BYTES} from '../lib/quest/report.mjs';

type Report = NonNullable<ReturnType<typeof parseReport>>;
const MAX_FILES = 80;
const input = document.querySelector<HTMLInputElement>('#class-files')!;
const status = document.querySelector<HTMLElement>('#class-status')!;
const wrap = document.querySelector<HTMLElement>('#class-table-wrap')!;
const table = document.querySelector<HTMLTableElement>('#class-grid')!;
const csvButton = document.querySelector<HTMLButtonElement>('#class-csv')!;
const clearButton = document.querySelector<HTMLButtonElement>('#class-clear')!;
let reports: Report[] = [];

function cell(row: HTMLTableRowElement, text: string, header = false) {
  const el = document.createElement(header ? 'th' : 'td');
  el.textContent = text; // names come from files: always text, never markup
  if (header) el.scope = 'col';
  row.append(el);
  return el;
}

function render() {
  table.querySelector('thead')?.remove();
  table.querySelector('tbody')?.remove();
  wrap.hidden = reports.length === 0;
  csvButton.disabled = clearButton.disabled = reports.length === 0;
  if (!reports.length) return;
  const sorted = [...reports].sort((a, b) => (a.name || '~').localeCompare(b.name || '~'));
  const head = table.createTHead().insertRow();
  const first = summarize(sorted[0]);
  ['Student', ...first.rows.map(r => r.name), 'Levels done', 'Total stars'].forEach(text => cell(head, text, true));
  const body = table.createTBody();
  for (const report of sorted) {
    const s = summarize(report);
    const row = body.insertRow();
    cell(row, report.name || 'Unnamed').className = 'class-name';
    s.rows.forEach(r => { const td = cell(row, `${r.stars} / ${r.max}`); td.className = r.stars === r.max ? 'full' : r.stars === 0 ? 'none' : ''; });
    cell(row, `${s.done} / ${s.total}`);
    cell(row, `${s.stars} / ${s.max}`).className = 'class-total';
  }
}

input.addEventListener('change', async () => {
  const files = [...(input.files || [])].slice(0, MAX_FILES);
  let skipped = 0;
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) { skipped++; continue; }
    const report = parseReport(await file.text());
    if (!report) { skipped++; continue; }
    // The newest file for each name replaces older ones.
    const key = report.name.toLowerCase();
    const index = key ? reports.findIndex(r => r.name.toLowerCase() === key) : -1;
    if (index === -1) reports.push(report);
    else if (report.saved >= reports[index].saved) reports[index] = report;
  }
  reports = reports.slice(0, 300);
  input.value = '';
  render();
  const extra = (input.files?.length || files.length) > MAX_FILES ? ` Only the first ${MAX_FILES} files were read at once.` : '';
  status.textContent = `${reports.length} student${reports.length === 1 ? '' : 's'} in the table.${skipped ? ` ${skipped} file${skipped === 1 ? ' was' : 's were'} skipped because ${skipped === 1 ? 'it is' : 'they are'} not Code Quest progress files.` : ''}${extra}`;
  status.className = 'feedback' + (skipped ? ' error' : reports.length ? ' success' : '');
});

csvButton.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([classCsv(reports)], {type: 'text/csv'}));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'code-quest-class.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
clearButton.addEventListener('click', () => {
  reports = [];
  render();
  status.textContent = 'Table cleared. Nothing was stored.';
  status.className = 'feedback';
});
