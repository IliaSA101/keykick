/**
 * Все тексты интерфейса. Тексты живут в src/i18n/, а не в компонентах:
 * так их видно разом, их проще выверить для 10-летнего и перевести.
 * Блоки лежат в ./ru/ по экранам (один файл не влезал в 600 строк), здесь — сборка в `ru`.
 * Страж tests/guards.test.ts не пускает кириллицу в остальной код.
 *
 * Второй язык (060-Т10): объект `satisfies Messages` — пропуск ключа ловит vue-tsc.
 */
import { home } from './ru/home';
import { keyboard, handsHelp } from './ru/keyboard';
import { kit } from './ru/kit';
import { map } from './ru/map';
import { match } from './ru/match';
import { paper } from './ru/paper';
import { parent } from './ru/parent';
import { phone } from './ru/phone';
import { result } from './ru/result';
import { frame, shell } from './ru/shell';
import { start } from './ru/start';
import { system } from './ru/system';

export const ru = {
  start,
  parent,
  phone,
  home,
  shell,
  frame,
  kit,
  system,
  keyboard,
  handsHelp,
  match,
  paper,
  result,
  map,
} as const;

/** Строки в `as const` — литералы; второму языку нужна форма, а не слово, поэтому литералы расширены до string. */
type Widen<T> = T extends string ? string : T extends object ? { [K in keyof T]: Widen<T[K]> } : T;

/** Форма текстов интерфейса: ключи и вложенность, как у `ru`. */
export type Messages = Widen<typeof ru>;
