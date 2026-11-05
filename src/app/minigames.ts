// Слова мини-игр: данные — в content, проверка — в движке (тест падает на ошибке в JSON).
import minigamesJson from '../content/minigames.json';
import { parseCapitals } from '../engine/minigames';
import { keymap } from './keymap';

export const capitals = parseCapitals(minigamesJson, keymap);
