// Shows saved stars on the Code Quest world map.
import {readStars, clearStars} from '../lib/quest/stars';

const starText = (earned: number) => '★'.repeat(earned) + '☆'.repeat(3 - earned);

function render() {
  const stars = readStars();
  let total = 0;
  let nextLink: HTMLAnchorElement | null = null;
  document.querySelectorAll<HTMLAnchorElement>('[data-quest-level]').forEach(link => {
    const earned = stars[link.dataset.questLevel!] || 0;
    total += earned;
    link.classList.toggle('played', earned > 0);
    link.classList.remove('next');
    if (!earned && !nextLink) nextLink = link;
    const el = link.querySelector<HTMLElement>('.quest-level-stars')!;
    el.textContent = starText(earned);
    el.setAttribute('aria-label', earned ? `${earned} of 3 stars` : 'Not played yet');
  });
  document.querySelectorAll<HTMLElement>('[data-quest-world]').forEach(el => {
    const slugs = el.dataset.questWorld!.split(',');
    el.textContent = `★ ${slugs.reduce((sum, slug) => sum + (stars[slug] || 0), 0)} / ${slugs.length * 3}`;
  });
  document.querySelectorAll('[data-quest-total]').forEach(el => { el.textContent = String(total); });
  const go = document.querySelector<HTMLAnchorElement>('#quest-continue');
  const next = nextLink as HTMLAnchorElement | null;
  if (go) {
    if (next) {
      next.classList.add('next');
      go.href = next.href;
      go.textContent = total ? 'Continue the quest →' : 'Start level 1 →';
    } else {
      go.href = '/quest/builder/';
      go.textContent = 'Build your own level →';
    }
  }
  const reset = document.querySelector<HTMLElement>('#quest-reset-stars');
  if (reset) reset.hidden = total === 0;
}

render();
window.addEventListener('quest-stars', render);
window.addEventListener('storage', render);
window.addEventListener('pageshow', render);
const dialog = document.querySelector<HTMLDialogElement>('#quest-stars-dialog');
document.querySelector('#quest-reset-stars')?.addEventListener('click', () => dialog?.showModal());
document.querySelector('#quest-stars-confirm')?.addEventListener('click', () => { clearStars(); dialog?.close(); });
