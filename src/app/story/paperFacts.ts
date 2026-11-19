/**
 * Факты выпуска газеты Двора (068 Т7, story.md §2): числа и имена из разделов сохранения, текстов здесь нет — их собирает `paperView`.
 * Чистая функция: Vue, DOM, часов и случайности нет. Данных нет — поле `null` или 0, заметка без числа (ТЗ-10.3).
 */
import cfg from '../../content/story-yard.json';
import yard from '../../content/yard.json';
import school from '../../content/school.json';
import { ourPlace, rivalOf, TEAMS } from '../../engine/cup';
import { groupTeams, OUR_GROUP } from '../../engine/cup/group';
import type { Cup, Team } from '../../engine/cup';
import { isHomeRound, ROUNDS } from '../../engine/home/yard';
import { REPEAT_KIND } from '../../engine/school/order';
import type { School } from '../../engine/school/section';
import type { PaperFixed, Story } from '../../engine/story';

/** Откуда читаются числа заметок: разделы игрока и семя Кубка. */
export interface PaperIn {
  story: Story;
  cup: Cup;
  school: School;
  /** Болельщики и голы клуба (`stadium`) — текущие; выпуск с записью дня выхода берёт числа оттуда. */
  fans: number;
  goals: number;
  /** Сыгранных матчей клуба (`day.played`). */
  played: number;
  /** Лучшая скорость клуба, зн/мин (лучший `best` по урокам курса); 0 — нет. */
  bestSpeed: number;
  /** Семя Кубка (`seedOf` игрока). */
  seed: number;
}

export type PaperNext = { kind: 'lesson'; lesson: number } | { kind: 'region' } | { kind: 'again' };

export interface PaperFacts {
  n: number;
  /** Игровой день выхода. */
  day: number;
  /** Выпуск 8 при проигранном финале. */
  silver: boolean;
  next: PaperNext;
  /** Урок «Дальше» на день выхода (для счёта «до матча — N уроков»); `null` — после Двора. */
  nextLesson: number | null;
  played: number;
  goals: number;
  fans: number;
  bestSpeed: number;
  /** Выпуск 3: первый соперник группы (команда нашей группы по порядку), дома ли первый матч. */
  firstRival: Team | null;
  firstHome: boolean;
  /** Счёт первого матча Кубка (любой исход, 068-Р18); null — матча не было. */
  score: { me: number; opp: number } | null;
  /** Урок-флажок ближайшего матча Кубка после выпуска и соперник на нём (выпуски 3, 5, 6, 7); `null` — нет. */
  flag: number | null;
  flagRival: Team | null;
  /** Выпуск 5: место в группе, 1 или 2. */
  place: 1 | 2 | null;
  /** Урок, после которого строится прожектор (выпуск 6). */
  lamp: number;
  /** Выпуск 8, серебро: кто победил в финале и счёт, если записан. */
  finalRival: Team | null;
  finalScore: { me: number; opp: number } | null;
  /** «Знаток Двора»: решённые задачи, туры с медалью, порог звания, звание получено. */
  tasks: number;
  medalTours: number;
  expertAt: number;
  title: boolean;
}

/** Урок-флажок следующего матча Кубка после выпуска: 3 → второй матч группы, 5 и 6 → 1/8, 7 → финал; у прочих нет. */
const FLAG_OF: Record<number, number> = { 3: ROUNDS[1]!, 5: ROUNDS[3]!, 6: ROUNDS[3]!, 7: ROUNDS[6]! };
const LAMP = yard.steps.find((s) => s.id === 'floodlight')?.after ?? 0;

/** Числа клуба сейчас — то, что записывается в выпуск при выходе (068-Р30) и что читают выпуски без снимка. */
export function numbersOf(i: PaperIn): PaperFixed {
  const tours = i.school.tours.filter((t) => t.kind !== REPEAT_KIND && t.medal >= 1).length;
  const silver = i.cup.title === null ? {} : { silver: i.cup.title === 'silver' }; // исход финала фиксируется с титулом (068-Р44): выпуск 8 — как вышел
  const fin = i.cup.ko.f;
  const final = i.cup.title === null || fin.me === null || fin.opp === null ? {} : { final: { me: fin.me, opp: fin.opp } }; // счёт финала — туда же (068-Р56)
  return { played: i.played, goals: i.goals, fans: i.fans, speed: i.bestSpeed, tasks: i.school.solved.length, tours, title: tours >= school.expertAt, ...silver, ...final };
}

export function paperFacts(n: number, i: PaperIn): PaperFacts {
  const fx = i.story.papers[String(n)]?.facts ?? numbersOf(i); // выпуск — запись дня выхода (068-Р30)
  const nextLesson = cfg.papers.find((p) => p.n === n)?.next ?? null;
  const silver = n === 8 && (fx.silver ?? i.cup.title === 'silver'); // снимок выпуска — «как вышел» (068-Р44); без поля — текущий Кубок
  const flag = FLAG_OF[n] ?? null;
  const first = groupTeams(OUR_GROUP)[1];
  const fin = fx.final ?? (i.cup.ko.f.me !== null && i.cup.ko.f.opp !== null ? { me: i.cup.ko.f.me, opp: i.cup.ko.f.opp } : null); // счёт финала — из снимка (068-Р56), без него текущий
  return {
    n,
    day: i.story.papers[String(n)]?.day ?? 0,
    silver,
    next: nextLesson !== null ? { kind: 'lesson', lesson: nextLesson } : silver ? { kind: 'again' } : { kind: 'region' },
    nextLesson,
    played: fx.played,
    goals: fx.goals,
    fans: fx.fans,
    bestSpeed: fx.speed,
    firstRival: TEAMS.find((t) => t.id === first) ?? null,
    firstHome: isHomeRound(ROUNDS[0]!),
    score: i.cup.first,
    flag,
    flagRival: flag === null ? null : rivalOf(flag),
    place: n === 5 ? ourPlace(i.cup, i.seed) : null,
    lamp: LAMP,
    finalRival: silver ? rivalOf(ROUNDS[6]!) : null,
    finalScore: silver ? fin : null,
    tasks: fx.tasks,
    medalTours: fx.tours,
    expertAt: school.expertAt,
    title: fx.title,
  };
}
