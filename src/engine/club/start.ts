/**
 * Первый запуск (спека 063 Т6а, К10): черновик клуба, шаги экрана `#/start`, расцветки и тренеры. Чистые функции:
 * случайность приходит снаружи (`rnd`), хранилища и роутера нет — их зовёт экран через мост `session` (063-Р31).
 * Порядок шагов — ТЗ-10.10: карточка «новый сезон» → «Твой клуб» (название, город, имя и номер на спине, расцветка) → тренер → приветствие.
 */
import clubs from '../../content/clubs.json';
import coach from '../../content/coach.json';
import type { ImportPlan } from '../save/import';
import type { Envelope } from '../save/envelope';
import { isObj, summarize } from '../save/snapshot';
import { BACK_NAME_MAX, CITY_MAX, NAME_MAX, NUMBER_MAX, type Club, type ClubKit } from './section';
import { yellowWithBlue } from './paint';

/** Палитры своего клуба (9 расцветок, лист Э2К.36); жёлтое с синим на форме отбрасывается (ТАБУ, В1). */
export const PALETTES: readonly ClubKit[] = clubs.palettes.filter((p) => !yellowWithBlue(p));
export const COACHES = coach.coaches;
export const DEFAULT_COACH: string = coach.default;
/** Имя тренера клуба для подписи реплики («Тренер Вера»); id нет или неизвестен — тренер по умолчанию. */
export function coachNameOf(id: string | undefined): string {
  const found = COACHES.find((c) => c.id === id) ?? COACHES.find((c) => c.id === DEFAULT_COACH);
  return found?.name ?? '';
}
/** Расцветка по умолчанию — клуб образца: зелёная с белым (023-Р30). */
export const DEFAULT_PALETTE = Math.max(0, PALETTES.findIndex((p) => p.body === '#2f9a27'));

export interface Draft {
  name: string;
  city: string;
  backName: string;
  /** 0 — не выбран. */
  backNumber: number;
  /** Индекс в `PALETTES`; −1 — расцветка текущего клуба не из набора (импорт, образец): она лежит в `kit` и сохраняется как есть. */
  palette: number;
  /** Своя расцветка при `palette < 0`. */
  kit?: ClubKit | undefined;
  coach: string;
}

export type Step = 'new' | 'load' | 'club' | 'coach' | 'greet';
export type StepEvent = 'club' | 'load' | 'back' | 'coach' | 'pick';

/** Переходы экрана; чужое событие на шаге — остаёмся (двойной клик и повторы ничего не ломают). */
export function nextStep(step: Step, ev: StepEvent): Step {
  if (step === 'new') return ev === 'club' ? 'club' : ev === 'load' ? 'load' : step;
  if (step === 'load') return ev === 'back' ? 'new' : step;
  if (step === 'club') return ev === 'back' ? 'new' : ev === 'coach' ? 'coach' : step;
  if (step === 'coach') return ev === 'back' ? 'club' : ev === 'pick' ? 'greet' : step;
  return ev === 'back' ? 'coach' : step;
}

const at = <T>(list: readonly T[], rnd: () => number): T => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))]!;

/** Слово для названия клуба («Придумать»): из `clubs.json`. */
export function suggestName(rnd: () => number): string {
  return at(clubs.words, rnd);
}

export function defaultDraft(rnd: () => number): Draft {
  return {
    name: suggestName(rnd),
    city: at(clubs.cities, rnd),
    backName: '',
    backNumber: 1 + Math.min(NUMBER_MAX - 1, Math.floor(rnd() * NUMBER_MAX)),
    palette: DEFAULT_PALETTE,
    coach: DEFAULT_COACH,
  };
}

/** Строка без лишних пробелов, не длиннее `max` знаков. */
export function cleanText(s: string, max: number): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, max);
}

// «ё» и «е» не различаем (\u0451 → \u0435): ребёнок печатает «орел»
const fold = (s: string): string => s.toLowerCase().replaceAll('\u0451', '\u0435');

/** Подсказки города по началу набора («орел» → «Орёл»); пустой набор — нет подсказок. */
export function cityHints(typed: string, limit = 5): string[] {
  const t = fold(cleanText(typed, CITY_MAX));
  if (t === '') return [];
  return clubs.cities.filter((c) => fold(c).startsWith(t)).slice(0, limit);
}

/** Название — обязательно; номер, если задан, 1–99. Остальное — по желанию. */
export function draftProblems(d: Draft): ('name' | 'number')[] {
  const why: ('name' | 'number')[] = [];
  if (cleanText(d.name, NAME_MAX) === '') why.push('name');
  if (!Number.isInteger(d.backNumber) || d.backNumber < 0 || d.backNumber > NUMBER_MAX) why.push('number');
  return why;
}

/** Цифры из набранного номера: буквы и знаки отбрасываются («a7» → «7»), не больше знаков, чем в `NUMBER_MAX`. */
export function numberDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, String(NUMBER_MAX).length);
}

/** Номер на спине из набранного: нет цифр — 0 («не выбран»). */
export function numberOf(raw: string): number {
  const d = numberDigits(raw);
  return d === '' ? 0 : Number.parseInt(d, 10);
}

/** Enter на выборе тренера: на кнопке («Выбрать», «Дальше») жмёт её сама; на карточке и вне кнопок — выбирает и подтверждает. */
export function coachEnter(focus: 'card' | 'button' | 'none'): 'native' | 'confirm' {
  return focus === 'button' ? 'native' : 'confirm';
}

/** Расцветка черновика: из набора по индексу; своя (`palette < 0`) — как есть; иначе клуб образца. */
export function draftKit(d: Draft): ClubKit {
  return PALETTES[d.palette] ?? (d.palette < 0 ? d.kit : undefined) ?? PALETTES[DEFAULT_PALETTE]!;
}

const sameKit = (a: ClubKit, b: ClubKit): boolean => a.body === b.body && a.pattern === b.pattern && a.sleeves === b.sleeves && a.trim === b.trim && a.alt === b.alt;

/** Черновик окна «Изменить» из текущего клуба: поля заполнены им же, расцветка — тот же набор или своя (молча на другую не меняем). */
export function draftOfClub(c: Club, coachId: string): Draft {
  const at = PALETTES.findIndex((p) => sameKit(p, c.kit));
  return { name: c.name, city: c.city, backName: c.backName, backNumber: c.backNumber, palette: at, kit: at < 0 ? { ...c.kit } : undefined, coach: coachId };
}

/** Раздел `club` из черновика: поля подрезаны под границы раздела (063-Р30). */
export function clubFromDraft(d: Draft): Club {
  const kit = draftKit(d);
  return {
    name: cleanText(d.name, NAME_MAX),
    kit: { ...kit },
    city: cleanText(d.city, CITY_MAX),
    coach: COACHES.some((c) => c.id === d.coach) ? d.coach : DEFAULT_COACH,
    backName: cleanText(d.backName, BACK_NAME_MAX).toUpperCase(),
    backNumber: d.backNumber,
  };
}

/** Имя игрока для `session.create`: имя на спине, иначе запасное (экран первого запуска имени игрока не спрашивает). */
export function playerNameOf(d: Draft, fallback: string): string {
  return cleanText(d.backName, BACK_NAME_MAX) || fallback;
}

/** Что знаем об игроке из файла для строки «Что изменится»; нет данных — факта нет (строку не заполняем прочерком, 063-Р46). */
export type Fact = { kind: 'lesson'; n: number } | { kind: 'coins'; n: number } | { kind: 'played'; date: string };
export interface RestoreRow {
  name: string;
  facts: Fact[];
}
/** Строка «Файл от <дата> · версия игры <версия>»: `null` — не разобрали, части в строке нет. */
export interface RestoreFile {
  date: string | null;
  version: string | null;
}

/** ISO-время или день `ГГГГ-ММ-ДД` → `ДД.ММ.ГГГГ` (день как записан в файле, без пересчёта в часовой пояс); не по форме — `null`. */
export function dmy(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
}

/** Версия игры для ребёнка и родителя: `2.0.0` → `2.0`; не по форме — как есть, пусто — `null`. */
export function shortVersion(app: string): string | null {
  const m = /^(\d+\.\d+)(?:\.|$)/.exec(app);
  return m ? m[1]! : app === '' ? null : app;
}

/**
 * Факты об игроке из файла, в порядке строки: «Урок N · Монеты N · Играл ДД.ММ.ГГГГ». `order` — порядок уроков курса
 * (пакет лиги, по сети): урока нет в нём или порядка нет (связи нет) — «Урок» пропускается; кошелька нет — «Монеты» тоже;
 * игровых дней не было (`day.today` пуст) — «Играл» тоже.
 */
export function restoreFacts(env: Envelope, order: readonly string[]): Fact[] {
  const facts: Fact[] = [];
  const sum = summarize(env);
  const at = sum.lesson === null ? -1 : order.indexOf(sum.lesson);
  if (at >= 0) facts.push({ kind: 'lesson', n: at + 1 });
  if (sum.coins !== null) facts.push({ kind: 'coins', n: sum.coins }); // монеты — раздел `wallet` (065-Р24), сводка читает его
  const day = Object.hasOwn(env.sections, 'day') ? env.sections['day']?.data : undefined;
  const date = isObj(day) && typeof day.today === 'string' ? dmy(day.today) : null;
  if (date !== null) facts.push({ kind: 'played', date });
  return facts;
}

/** Ответ проверки файла клуба: годен (с игроками для «Что изменится») или не подошёл (битый, чужой, новее игры). */
export type LoadCheck = { phase: 'check'; file: RestoreFile; players: RestoreRow[] } | { phase: 'bad' };

/**
 * Почему файл не подошёл (063-Р49 п. 3): `newer` — снимок сохранён в более новой версии игры (нужно обновить страницу),
 * всё остальное — `bad` (не открывается: повреждён, чужой, пустой). Одна причина, без перечисления «или так, или эдак».
 */
export function badReason(plan: ImportPlan): 'bad' | 'newer' {
  return plan.kind === 'newer' ? 'newer' : 'bad';
}

/** Дата и версия игры из шапки файла для строки «Файл от …» (063-Р46): часть, которую не разобрали, — `null`. */
export function restoreFile(file: { made: string; app: string }): RestoreFile {
  return { date: dmy(file.made), version: shortVersion(file.app) };
}

export function loadCheck(plan: ImportPlan, order: readonly string[] = []): LoadCheck {
  if (plan.kind !== 'ok' || plan.add.length === 0) return { phase: 'bad' };
  return {
    phase: 'check',
    file: restoreFile(plan.file),
    players: plan.add.map((env) => ({ name: env.name, facts: restoreFacts(env, order) })),
  };
}
