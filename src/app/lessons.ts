// Уроки и словарь: данные — в content, проверка — в движке (тест падает на ошибке в JSON).
import lessonsJson from '../content/lessons.json';
import wordsJson from '../content/words.json';
import { parseLessons, parseWords } from '../engine/lessons';
import { keymap } from './keymap';

export const lessons = parseLessons(lessonsJson, keymap);
export const wordsRu = parseWords(wordsJson, keymap, 'ru');
