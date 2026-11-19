/** Типы Кубка Двора (контракт 068 design §2–3): команда, туры и раунды, раздел сохранения, вид для экрана. */

/** Команда Кубка: запись `content/cup-yard.json`. Нашей команды («Прогресс» — клуб ребёнка) в списке нет. */
export interface Team {
  /** Устойчивый id (латиница): не переименовывать (059). */
  id: string;
  name: string;
  /** Улица двора в родительном падеже: «двор на <улица>» (`ru.home.rival`). */
  street: string;
  /** Группа Кубка `A`…`H`; `C` — наша. */
  group: string;
  /** Цвет формы и эмблемы команды; `c2` — второй цвет (вторая форма, кант эмблемы). */
  c1: string;
  c2: string;
  /** Белый силуэт эмблемы (`docs/mockups/champ/img/em/sym/<symbol>.webp`). */
  symbol: string;
}

/** Раунд плей-офф: 1/8, 1/4, полуфинал, финал. */
export type KoRound = 'r16' | 'qf' | 'sf' | 'f';
/** Раунд Кубка ребёнка: три тура группы и четыре раунда плей-офф — семь флажков Карты (ТЗ-1.5). */
export type RoundKey = 'g1' | 'g2' | 'g3' | KoRound;

/** Тур группы. `me`/`opp` — счёт засчитанного тура (победа или ничья), `null` — тур ещё не засчитан; `tries` — проигранных попыток (тур снова, ТЗ-8.5). */
export interface Tour {
  me: number | null;
  opp: number | null;
  tries: number;
}

/** Раунд плей-офф: последний засчитанный счёт, `series` — исход серии при ничьей (`null` — серии не было). */
export interface KoState {
  tries: number;
  won: boolean;
  me: number | null;
  opp: number | null;
  series: 'w' | 'l' | null;
}

/** Счёт первого матча Кубка: наши голы и голы соперника (проигранный — тоже). */
export interface FirstScore {
  me: number;
  opp: number;
}

/**
 * Раздел сохранения `cup` (068 design §3). Чужие матчи не хранятся: считаются от семени (хэш id игрока, 068-Р4) и номера тура (ТЗ-8.12).
 * `first` — счёт первого сыгранного матча Кубка при любом исходе (заголовок газеты №3 «{a}:{b}», 068-Р18); `null` — матчей ещё не было.
 * `packs` — раунды, за которые пак уже выдан (ТЗ-5.1); `title` — `silver` после проигранного финала, `gold` после победы; `replays` — повторы после титула.
 */
export interface Cup {
  tours: [Tour, Tour, Tour];
  ko: Record<KoRound, KoState>;
  first: FirstScore | null;
  packs: RoundKey[];
  title: 'gold' | 'silver' | null;
  titleDay: string | null;
  replays: number;
}

/** Вход модели из состояния игры: часы и случайность — снаружи (`seed` — `seedOf(id игрока)`). */
export interface CupCtx {
  /** Следующий урок Двора 1…33 (как `HomeInput.cur`): якорь пройден, когда `cur` больше его номера. */
  cur: number;
  /** Сегодняшний день `ГГГГ-ММ-ДД` (для `titleDay`). */
  day: string;
  /** Номер игрового дня ребёнка: 1 — первый; Кубок открывается с 3-го (048-Р36). */
  dayN: number;
  /** Пауза ≥ 5 дней: перед матчем — разминка (038-Р18). */
  pause5: boolean;
  seed: number;
}

/** Состояние раунда на пути ребёнка (068 design §4). */
export type RoundState = 'before' | 'day3' | 'later' | 'open' | 'replay' | 'wait' | 'won';

/** Строка таблицы группы; `team` — id команды или `our`. `byTour` — исход и счёт каждого тура с точки зрения команды строки. */
export interface TableRow {
  team: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
  byTour: ({ r: 'W' | 'D' | 'L'; f: number; a: number } | null)[];
}

export interface GroupView {
  letter: string;
  our: boolean;
  /** Сыграно туров (у чужих — столько же, сколько засчитано нашей группе). */
  played: number;
  /** Номер тура нашей группы, проигранного и ждущего переигровки, иначе 0. */
  lost: number;
  rows: TableRow[];
}

/** Счёт ячейки сетки с точки зрения сторон `a`, `b`; `pen` — решила серия. */
export interface CellScore {
  a: number;
  b: number;
  pen: boolean;
}

/** Ячейка сетки. `a`/`b` — id команды, `our`, либо `null`, пока неизвестно (подпись — `refA`/`refB`). `win` — победившая сторона, когда раунд сыгран. */
export interface Cell {
  a: string | null;
  b: string | null;
  refA: string;
  refB: string;
  win: 'a' | 'b' | null;
  score: CellScore | null;
  /** Наш матч проигран, ждёт ответного. */
  lost: boolean;
}

export type Bracket = Record<KoRound, Cell[]>;

export interface PathItem {
  round: RoundKey;
  /** Урок-якорь (флажок Карты). */
  flag: number;
  /** Соперник: id команды; `null` — ещё неизвестен. */
  rival: string | null;
  home: boolean;
  state: RoundState;
}

export type CupStage = 'group1' | 'group2' | 'group3' | KoRound | 'done';

export interface CupNext {
  /** `null` — Кубок взят (`done`). */
  round: RoundKey | null;
  flag: number | null;
  rival: string | null;
  home: boolean;
  state: RoundState | 'done';
  /** Раунд открыт, но сначала разминка (пауза ≥ 5 дней). */
  warmup: boolean;
}

export interface CupView {
  stage: CupStage;
  groups: GroupView[];
  /** Индекс нашей группы в `groups`. */
  ours: number;
  bracket: Bracket;
  path: PathItem[];
  next: CupNext;
  title: 'gold' | 'silver' | null;
}

export interface CupMilestones {
  /** Первый матч Кубка сыгран (любой исход, в том числе проигранный). */
  first: boolean;
  /** Счёт первого матча для заголовка газеты; `null`, пока матча не было. */
  firstScore: FirstScore | null;
  /** Группа пройдена. */
  group: boolean;
  /** Полуфинал выигран. */
  semi: boolean;
  final: 'gold' | 'silver' | null;
}
