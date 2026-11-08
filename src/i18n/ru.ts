/**
 * Все тексты интерфейса. Язык пока один, но тексты живут в src/i18n/, а не в компонентах:
 * так их видно разом, их проще выверить для 10-летнего и, если понадобится, перевести.
 * Блоки лежат в ./ru/ по экранам (один файл не влезал в 600 строк), здесь — сборка в `ru`.
 * Страж tests/guards.test.ts не пускает кириллицу в остальной код.
 */
import { nav, news, locker, boots } from './ru/menu';
import { penalty } from './ru/penalty';
import { keyboard, handsHelp } from './ru/keyboard';
import { match, midPenalty, halftime } from './ru/match';
import { match2 } from './ru/match2';
import { match2Result } from './ru/match2Result';
import { session, players, parent } from './ru/parent';
import { sound } from './ru/cup';
import { crash, backup } from './ru/system';
import { clubForm, firstRun } from './ru/firstRun';
import { map, clubPath } from './ru/map';

export const ru = {
  appTitle: 'Клавиатурная лига',
  tagline: 'Тренируй пальцы — забивай голы',
  placeholder: 'Этот экран скоро появится.',

  nav,
  news,
  locker,
  boots,
  clubForm,
  firstRun,
  map,
  clubPath,
  penalty,
  keyboard,
  handsHelp,
  match,
  match2,
  match2Result,
  midPenalty,
  halftime,
  session,
  players,
  parent,
  sound,
  crash,
  backup,
} as const;
