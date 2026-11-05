// Карта клавиатуры ребёнка: данные — в content, проверка — в движке (тест падает на ошибке в JSON).
import keyboardJson from '../content/keyboard.json';
import { parseKeymap } from '../engine/keymap';

export const keymap = parseKeymap(keyboardJson);
