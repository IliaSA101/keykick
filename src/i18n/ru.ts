/**
 * Все тексты интерфейса. Тексты живут в src/i18n/, а не в компонентах:
 * так их видно разом, их проще выверить для 10-летнего и перевести.
 * Блоки лежат в ./ru/ по экранам (один файл не влезал в 600 строк), здесь — сборка в `ru`.
 * Страж tests/guards.test.ts не пускает кириллицу в остальной код.
 *
 * Второй язык (060-Т10): объект `satisfies Messages` — пропуск ключа ловит vue-tsc.
 */
import { album } from './ru/album';
import { base } from './ru/base';
import { club } from './ru/club';
import { coach } from './ru/coach';
import { cup } from './ru/cup';
import { home } from './ru/home';
import { keyboard, handsHelp } from './ru/keyboard';
import { kit } from './ru/kit';
import { league } from './ru/league';
import { learn } from './ru/learn';
import { map } from './ru/map';
import { match } from './ru/match';
import { museum } from './ru/museum';
import { paper } from './ru/paper';
import { parent } from './ru/parent';
import { support } from './ru/support';
import { path } from './ru/path';
import { phone } from './ru/phone';
import { result } from './ru/result';
import { school } from './ru/school';
import { frame, shell } from './ru/shell';
import { shop } from './ru/shop';
import { start } from './ru/start';
import { day } from './ru/day';
import { story } from './ru/story';
import { system } from './ru/system';

export const ru = {
  start,
  parent,
  phone,
  home,
  shell,
  frame,
  kit,
  support,
  system,
  keyboard,
  handsHelp,
  match,
  paper,
  result,
  map,
  path,
  club,
  coach,
  cup,
  museum,
  story,
  day,
  shop,
  album,
  school,
  learn,
  base,
  league,
} as const;

/** Строки в `as const` — литералы; второму языку нужна форма, а не слово, поэтому литералы расширены до string. */
type Widen<T> = T extends string ? string : T extends object ? { [K in keyof T]: Widen<T[K]> } : T;

/** Форма текстов интерфейса: ключи и вложенность, как у `ru`. */
export type Messages = Widen<typeof ru>;
