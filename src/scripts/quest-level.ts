import {mountGame} from './quest/game';
import {levelBySlug, worlds} from '../lib/quest/levels.mjs';

const root = document.querySelector<HTMLElement>('.quest-game');
const level = root && levelBySlug(root.dataset.level);
if (root && level) mountGame(root, level, {theme: worlds[level.world].theme});
