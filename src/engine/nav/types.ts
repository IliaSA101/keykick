/** Типы модели навигации Двора: «сохранение + адрес + ввод → вид» (054 §2, 063 Т3). Без Vue и DOM. */
import type { League, Screen } from './leagues';

/** Что нужно из сохранения игрока: текущая лига L (событие «переезд», 054-Р2; без него — Двор) и «L пройдена». */
export interface NavSave {
  league: League;
  leagueDone: boolean;
}

/** Контекст одного вызова: сохранение и то, что приносит приложение (не хранится ради вида, 054-Р9). */
export interface NavCtx extends NavSave {
  /** Ступеней Дома без «Карты»; во Дворе — всегда 0 (шкалы нет, 054-Р4). Район: 2, Город: 2, дальше — по спеке лиги (Р15). */
  homeSteps: number;
  /** Сколько раз игрок уже входил в Путь клуба, пока L — нынешняя лига (приложение считает по `effect.to === 'path'`). */
  entries: number;
  /** «Меньше движения» (N7). */
  reduced: boolean;
}

/** Куда ведёт упор: следующая прокрутка после паузы переведёт на этот экран (054-Р16). */
export interface Bump {
  to: 'home' | 'map' | 'path';
  at: number;
}

/** Состояние навигации; всегда в нормальном виде (`settle`). */
export interface NavState {
  screen: Screen;
  /** N4: лига на Карте; вне Карты — L. */
  mapLeague: League;
  /** N3: ступень Дома, 0…homeSteps−1; во Дворе — 0. */
  homeStep: number;
  /** C: камера Пути клуба; выбор Sel всегда равен ей (Z1). Вне Пути клуба — L. */
  pathLevel: League;
  bump: Bump | null;
  /** N5: до какого момента идёт переход (мс); 0 — покой. */
  busyUntil: number;
  /** N5: ввод, ждущий конца перехода; в очереди не больше одного. */
  queued: NavInput | null;
}

export type NavInput =
  | { t: 'menu'; item: Screen }
  | { t: 'chipMap' }
  | { t: 'esc' }
  | { t: 'enter' }
  /** `in` — «ближе», `out` — «дальше». */
  | { t: 'wheel'; dir: 'in' | 'out' }
  | { t: 'arrow'; dir: 'left' | 'right' }
  /** Наведение мыши на деление: подсказка, не выбор (054-Р1, Z1). */
  | { t: 'hover'; league: League };

/**
 * Вид перехода между экранами — для моушна (061):
 * `full` — Дом → уровень L, полный отъезд (Э7.192–196, Р10); `short` — короткий отъезд от Дома (Р17);
 * `layerOff` — с Карты: слой лиги гаснет, Дома нет (Р11); `layerOn` — с Пути на Карту: слой проявляется;
 * `camera` — Дом ↔ Карта; `cut` — прочее (Кубок, Клуб — вне модели лиг).
 */
export type Via = 'full' | 'short' | 'layerOff' | 'layerOn' | 'camera' | 'cut';

export type NavEffect =
  /** Ничего: холостой ввод, край шкалы, пауза упора не прошла. */
  | { kind: 'none' }
  | { kind: 'bump'; to: Bump['to'] }
  /** Enter, а главная кнопка — функция ТЗ-1.5 снаружи (Р12). */
  | { kind: 'main' }
  | { kind: 'queued' }
  | { kind: 'dropped' }
  /** `league` — уровень, на котором откроется Путь клуба, или лига Карты. */
  | { kind: 'go'; from: Screen; to: Screen; via: Via; league?: League }
  | { kind: 'level'; from: League; to: League }
  | { kind: 'homeStep'; from: number; to: number };

/** Какая главная кнопка (Z10): без своей подстановки 054 (Р12). */
export type MainButton =
  /** Функция ТЗ-1.5 «состояние → действие»: Дом, Карта лиги L, Путь клуба при C ≥ L. */
  | { kind: 'tz15' }
  /** Карта прошлой лиги: играть урок, не ТЗ-1.5. */
  | { kind: 'lesson' }
  /** Путь клуба при C < L: «На карту <C>» и «Вернуться в <L>» (Р6). */
  | { kind: 'toMap'; league: League; back: League };

export interface NavView {
  screen: Screen;
  /** Активный пункт меню — всегда экран (Z2). */
  menuActive: Screen;
  /** Лига, которую показывает Дом или Карта; на Пути клуба и вне модели — `null`. */
  league: League | null;
  /** Путь клуба: камера и выбор — одно значение (Z1). */
  level: League | null;
  selected: League | null;
  /** Деления шкалы лиг — только на Пути клуба (Z2, Z6, Z7). */
  scaleLevels: readonly League[];
  /** Шкала Дома — на Доме и Карте лиги L выше Двора (Z7). */
  scaleHome: boolean;
  homeStep: number | null;
  /** Чип «Карта» на Доме Двора (054-Р4). */
  chipMap: boolean;
  /** Транспорт — только на Карте (Z5). */
  transport: boolean;
  /** «Ты здесь» — про лигу L или нет совсем (Z4). */
  here: League | null;
  /** Плашка «ты в <L>» на Карте прошлой лиги. */
  pastPlaque: League | null;
  main: MainButton | null;
  /** Путь клуба: «Следующее» — лига L+1, когда L пройдена, а переезда ещё не было (Э7.184–185, 054-Р2). */
  next: League | null;
  /** Куда поведёт следующая прокрутка, если упор уже был. */
  bumped: Bump['to'] | null;
}

export interface NavResult {
  state: NavState;
  view: NavView;
  /** Что произошло: сначала снятое с очереди, потом сам ввод. */
  effects: NavEffect[];
}
