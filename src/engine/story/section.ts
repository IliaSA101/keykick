/**
 * Раздел `story` (068 Т3, story.md §4а): какие комиксы и выпуски газеты показаны, день выхода выпусков, дни, когда
 * тренер уже дал совет и сказал «пальцы устали». Дни — игровые, номером (`Day.days`); 0 допустим: «Завязка» показывается
 * при первом входе на Дом, до первого матча. Флаг «показан» ставится при открытии окна: перезагрузка с открытым окном —
 * не повтор (ТЗ-10.3).
 */
import { badCounters, isInt, isRecord, type SectionDef } from '../save/section';
import cfg from '../../content/story-yard.json';

export type ComicId = 'intro' | 'group' | 'final' | 'silver';
export const COMIC_IDS: readonly ComicId[] = cfg.comics.map((c) => c.id as ComicId);
/** Сколько выпусков у Двора (ТЗ-9.3). */
export const PAPER_COUNT: number = cfg.papers.length;

/** Числа выпуска на день выхода (068-Р30): газета — запись дня, архив Музея показывает выпуск как он вышел, а не «растущий». */
export interface PaperFixed {
  /** Сыгранных матчей, голов и болельщиков клуба. */
  played: number;
  goals: number;
  fans: number;
  /** Лучшая скорость клуба, зн/мин; 0 — нет. */
  speed: number;
  /** Рубрика «Знаток Двора»: решённые задачи, туры с медалью, звание получено. */
  tasks: number;
  tours: number;
  title: boolean;
  /** Есть у снимка, записанного с титулом Кубка (068-Р44): финал на день выхода проигран. Нет поля — снимок прежний, серебро читается из текущего Кубка. */
  silver?: boolean;
  /** Счёт финала на день выхода (068-Р56), если титул записан со счётом; нет — читается текущий. Соперник финала — по уроку-финалу, в снимок не нужен. */
  final?: { me: number; opp: number };
}

export interface Paper {
  /** Игровой день выхода (вехи). */
  day: number;
  /** Окно уже открывали (показан один раз). */
  shown: boolean;
  /** Числа на день выхода; нет у выпусков, вышедших без снимка (прежние сохранения готовящейся версии) — тогда берутся текущие. */
  facts?: PaperFixed;
}

const FIXED_COUNTS = ['played', 'goals', 'fans', 'speed', 'tasks', 'tours'] as const;
/** Снимок чисел выпуска целиком: счётчики — неотрицательные целые, звание — флаг. */
const finalOk = (f: unknown): boolean => f === undefined || (isRecord(f) && badCounters(f, ['me', 'opp']).length === 0);
const fixedOk = (f: unknown): boolean => isRecord(f) && badCounters(f, FIXED_COUNTS).length === 0 && typeof f.title === 'boolean' && (f.silver === undefined || typeof f.silver === 'boolean') && finalOk(f.final);

export interface Story {
  /** Комикс → игровой день, когда окно открыли. */
  comics: Partial<Record<ComicId, number>>;
  /** Номер выпуска (строкой, ключ JSON) → выход и показ. */
  papers: Record<string, Paper>;
  /** Игровой день последнего совета ритма; 0 — не было. */
  adviceDay: number;
  /** Игровой день последнего «пальцы устали»; 0 — не было. */
  tiredDay: number;
}

export const emptyStory = (): Story => ({ comics: {}, papers: {}, adviceDay: 0, tiredDay: 0 });

export const storyDef: SectionDef<Story> = {
  name: 'story',
  v: 1,
  empty: emptyStory,
  up: {},
  check(d) {
    if (!isRecord(d)) return ['shape'];
    const why = badCounters(d, ['adviceDay', 'tiredDay']);
    if (!isRecord(d.comics) || !Object.entries(d.comics).every(([k, v]) => (COMIC_IDS as readonly string[]).includes(k) && isInt(v) && v >= 0)) why.push('comics');
    if (!isRecord(d.papers) || !Object.entries(d.papers).every(([k, v]) => isInt(Number(k)) && Number(k) >= 1 && Number(k) <= PAPER_COUNT && isRecord(v) && isInt(v.day) && v.day >= 0 && typeof v.shown === 'boolean' && (v.facts === undefined || fixedOk(v.facts)))) why.push('papers');
    return why;
  },
};
