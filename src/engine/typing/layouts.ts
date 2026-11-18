/**
 * Карта клавиатуры сборки: данные — файлы раскладок в `content/layouts/`, сборка и проверка — `parseKeymap`.
 * Ключ раскладки в карте — её id (`jcuken-win`, `qwerty-win`), его же называет курс (`course.json`, поле `layout`).
 * Новая раскладка — файл в `content/layouts/` и строка здесь.
 */
import jcuken from '../../content/layouts/jcuken-win.json';
import qwerty from '../../content/layouts/qwerty-win.json';
import { parseKeymap } from './keymap';

export const keymap = parseKeymap({ 'jcuken-win': jcuken, 'qwerty-win': qwerty });
