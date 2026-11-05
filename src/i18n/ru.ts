/**
 * Все тексты интерфейса. Язык пока один, но тексты живут в src/i18n/, а не в компонентах:
 * так их видно разом, их проще выверить для 10-летнего и, если понадобится, перевести.
 * Блоки лежат в ./ru/ по экранам (один файл не влезал в 600 строк), здесь — сборка в `ru`.
 * Страж tests/guards.test.ts не пускает кириллицу в остальной код.
 */
import { nav, home, news, locker, boots, club, pack } from './ru/menu';
import { penalty } from './ru/penalty';
import { keyboard, handsHelp } from './ru/keyboard';
import { match, midPenalty, penaltyScreen, halftime } from './ru/match';
import { stats, session, players, parent } from './ru/parent';
import { unlocks, sound, cup } from './ru/cup';

export const ru = {
  appTitle: 'Клавиатурная лига',
  tagline: 'Тренируй пальцы — забивай голы',
  placeholder: 'Этот экран скоро появится.',

  nav,
  home,
  news,
  locker,
  boots,
  club,
  pack,
  penalty,
  keyboard,
  handsHelp,
  match,
  midPenalty,
  penaltyScreen,
  halftime,
  stats,
  session,
  players,
  parent,
  unlocks,
  sound,
  cup,
} as const;
