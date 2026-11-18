/**
 * Вход и выход правил Дома (065 К-Д, 048 §4): во входе — только данные (без маршрутов и функций), в выходе — ключи
 * и числа, не строки: тексты — `src/i18n/ru/home.ts` (Т7). Собирает вход `app/home/input.ts` (Т7) из разделов сохранения.
 */

/** Здание Дома, у которого есть табличка. */
export type HouseId = 'school' | 'locker' | 'base' | 'museum';

/** Событие дня на табличке здания: ключ i18n и параметры (поставщик здания; пусто — события нет). */
export interface HouseEvent {
  key: string;
  params?: Record<string, string | number>;
}

/** Карточка Кубка от поставщика Кубка (037): ключ i18n и параметры; нет поставщика — `null` (065-Р3). */
export interface CupData {
  key: string;
  params?: Record<string, string | number>;
}

/** Данные поставщиков следующих волн (065-Р3): пустой объект — все поля необязательны. */
export interface HomeExtras {
  /** Карточка Кубка, когда раунда на главной кнопке нет. */
  cup?: CupData | null;
  events?: Partial<Record<HouseId, HouseEvent>>;
  /** Выпусков газеты Двора вышло (0 — Музей закрыт замком). */
  papers?: number;
  /** Игровой день, когда вышел последний выпуск: метка «свежая газета» живёт до конца этого дня. */
  paperDay?: number | null;
  /** Части эмблемы «Школы», 0…10. */
  emblemN?: number;
  /** «Тур ждёт» (модель Школы): после первого матча дня, если сегодня играется тур. */
  tourWaits?: boolean;
  /** Финал проигран (серебро): подпись «Двор пройден · Кубок: серебро». */
  silver?: boolean;
}

export interface HomeInput {
  /** Номер текущего урока Двора, 1…32; 33 — Двор пройден. */
  cur: number;
  /** Игровой день (ТЗ-10.2), с 1. */
  day: number;
  /** Матчей сыграно сегодня. */
  matchesToday: number;
  /** Матчей доиграно всего (раздел `day`); замки считают матчи, а не уроки (ТЗ-1.9). */
  played: number;
  /** Звёзды уроков Двора по номеру урока 1…32 (нет — 0). */
  stars: Record<number, number>;
  /** Рекорд текущего урока, знаков в минуту; 0 — рекорда нет. */
  best: number;
  coins: number;
  fans: number;
  /** Id купленных вещей из каталога `yard.json`. */
  bought: string[];
  /** Текущий урок — товарищеский (из пакета). */
  friendly: boolean;
  /** Номер урока-флажка неначатого раунда Кубка (он на главной кнопке); `null` — раунда нет. */
  round: number | null;
  /** Кубок выигран: Двор закончен титулом. */
  end: boolean;
  /** Район есть (кнопка «В Район»). */
  region: boolean;
  /** Возврат после паузы ≥ 5 дней: на главной разминка без счёта (ТЗ-2.11). */
  pause5: boolean;
  extras: HomeExtras;
}

/** Главная кнопка Дома: одна на экран. `lesson` — номер урока, `flag` — урок-флажок раунда, `street` — индекс двора-соперника 0…9. */
export type MainAction =
  | { kind: 'round'; flag: number; home: boolean; street: number; nextLesson: number | null }
  | { kind: 'lesson'; lesson: number; control: boolean; friendly: boolean; home: boolean; street: number; best: number; warm: boolean; waitingFlag: number | null }
  | { kind: 'region'; cup: 'ours' | 'silver' | 'waits' }
  | { kind: 'stars'; missing: number; from: number; to: number };

/** Карточка Кубка двора на Доме. */
export type CupCard =
  | { key: 'flag'; flag: number; final: boolean; afterWarmup: boolean }
  | { key: 'ours' }
  | { key: 'before' }
  | { key: 'provided'; data: CupData };

/** Табличка здания: замок, подпись, метка. `n` — сколько матчей до открытия. */
export interface HouseView {
  lock: { key: 'matches' | 'firstPaper'; n: number; alt: 'next' | 'day3' | null } | null;
  sub: { key: 'afterMatch' | 'tourWaits' | 'emblem' | 'goldAward' | 'event'; n?: number; event?: HouseEvent } | null;
  mark: '' | 'new' | 'freshPaper';
}

/** Мечта в шапке (ТЗ-10.1). `item` — id вещи, `left` — сколько монет не хватает. */
export type Dream =
  | { kind: 'done'; pct: 100 }
  | { kind: 'locked'; item: string; from: number; pct: 0 }
  | { kind: 'buy'; item: string; pct: 100 }
  | { kind: 'save'; item: string; left: number; pct: number };
