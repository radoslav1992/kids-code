import {readProgress,clearProgress} from '../lib/progress';
function render(){const ids=readProgress();document.querySelectorAll<HTMLElement>('[data-completion]').forEach(el=>{const done=ids.includes(el.dataset.completion!);el.textContent=done?'✓ Discovered':'Try it';el.classList.toggle('finished',done);});document.querySelectorAll('[data-total]').forEach(el=>el.textContent=String(ids.length));}
render();window.addEventListener('kids-progress',render);window.addEventListener('storage',render);
document.querySelector('[data-reset-progress]')?.addEventListener('click',()=>{const dialog=document.querySelector<HTMLDialogElement>('#reset-dialog');dialog?.showModal();});
document.querySelector('[data-confirm-reset]')?.addEventListener('click',()=>{clearProgress();document.querySelector<HTMLDialogElement>('#reset-dialog')?.close();});
