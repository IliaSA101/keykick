/**
 * Связка Базы с сеансом (067 Т19, К-Д): что экран читает из разделов `base` и `learn`, вид Базы целиком, охрана адреса игры, вход в
 * учебную игру окном (место «База») и запись итога игры на интерес. Чистые функции: разделы, часы, день и статус приходят снаружи.
 * Движок — `engine/base` (правила Б-З1…Б-З4 живут там), `engine/learn` (учебные); здесь только проводка, правил нет.
 */
import { systemOpen, type HomeInput } from '../../engine/home';
import { baseView, FUN_GAMES, type BaseCtx, type BaseView, type FunId } from '../../engine/base/open';
import { baseDef, type Base } from '../../engine/base/section';
import { finishFun, type FunFinish, type FunResult } from '../../engine/base/finish';
import { baseList, GAMES, type BaseItem, type LearnCtx } from '../../engine/learn/queue';
import { learnDef, type Learn } from '../../engine/learn/section';
import type { Step } from '../../engine/learn/steps';
import { FIRSTS_MAX, seenDef, type Seen } from '../../engine/seen/section';
import { breakCtx, learnRead, type EntryFacts } from '../learn/entry';
import type { Status } from '../save/session';
import { openLearn, type LearnFlow } from '../learn/run';
import { beforeOf, stakeOf } from '../learn/view';
import { fill } from '../home/texts';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';

type Sections = Readonly<Record<string, { data: unknown } | undefined>> | undefined;

/** Раздел `base` из сеанса; нет раздела — пустой (ребёнок на Базе ещё не играл). */
export const baseOf = (sections: Sections): Base => (sections?.[baseDef.name]?.data as Base | undefined) ?? baseDef.empty();
const learnOf = (sections: Sections): Learn => (sections?.[learnDef.name]?.data as Learn | undefined) ?? learnDef.empty();

/** Факты для правил Базы из входа Дома: замок ТЗ-1.9 (`systemOpen`), номер текущего урока, матчи дня. Кубка в этапе Э1 нет — Штрафной закрыт (067-Р18); `cupPlayed` ставит только стенд кадров. */
export function baseCtxOf(i: HomeInput, day: string, cupPlayed = false): BaseCtx {
  return { day, cur: i.cur, open: systemOpen('base', i), matchesToday: i.matchesToday, cupPlayed };
}

/** Строка списка учебных игр Базы: что показать (метка ступени, подпись, замок). */
export interface LearnRow extends BaseItem {
  /** Урок, с которого игра открыта (подпись «откроется с урока N»). */
  lesson: number;
  /** Тренажёр «Школы» (открывается и по туру): метка «к «Школе»» зелёным. */
  toSchool: boolean;
  /** Что сказать второй строкой: новая · до серебра · до золота · на золоте · закрыта. */
  line: 'new' | 'toSilver' | 'toGold' | 'onGold' | 'closed';
}

export interface BaseScreenView extends BaseView {
  learn: LearnRow[];
}

const lineOf = (r: BaseItem): LearnRow['line'] => (!r.open ? 'closed' : r.step === 0 ? 'new' : r.step === 1 ? 'toSilver' : r.step === 2 ? 'toGold' : 'onGold');

/** Вид Базы: игры на интерес (`baseView`) и список учебных (`baseList`) — всё, что рисует экран. */
export function baseScreen(sections: Sections, ctx: BaseCtx, learnCtx: LearnCtx): BaseScreenView {
  const learn = learnOf(sections);
  const rows = baseList(learn, learnCtx).map((r): LearnRow => {
    const def = GAMES.find((g) => g.id === r.id);
    return { ...r, lesson: def?.lesson ?? 0, toSchool: (def?.tour ?? null) !== null, line: lineOf(r) };
  });
  return { ...baseView(baseOf(sections), learn, ctx), learn: rows };
}

/** Первая открытая игра на интерес — её кнопка главная (Enter, 036-Р12); `null` — открытых нет. */
export const firstOpen = (view: BaseView): FunId | null => (view.fun.find((f) => f.open && f.newMark) ?? view.fun.find((f) => f.open))?.id ?? null;

/** Когда поставлен рекорд: сегодня · вчера · день недели (0 — понедельник … 6 — воскресенье, в пределах недели) · иначе дата. */
export type When = { kind: 'today' } | { kind: 'yesterday' } | { kind: 'weekday'; weekday: number } | { kind: 'date'; day: number; month: number };

/** Дни — строки `ГГГГ-ММ-ДД`, считаются по календарю без часов (чистая функция). */
export function recordWhen(day: string, today: string): When {
  const at = Date.parse(`${day}T00:00:00Z`);
  const ago = Math.round((Date.parse(`${today}T00:00:00Z`) - at) / 86400000);
  const d = new Date(at);
  if (ago <= 0) return { kind: 'today' };
  if (ago === 1) return { kind: 'yesterday' };
  if (ago < 7) return { kind: 'weekday', weekday: (d.getUTCDay() + 6) % 7 };
  return { kind: 'date', day: d.getUTCDate(), month: d.getUTCMonth() + 1 };
}

/** Единица рекорда по числу: «удара подряд», «хода»; у Штрафного — «гола» (общая единица `ru.result.goals`). */
export const unitOf = (id: FunId, n: number): string => plural(n, id === 'free' ? ru.result.goals.unit : ru.base.fun[id].unit);

/** «рекорд · в пятницу» — когда поставлен рекорд, словами (общая подпись карточки и доски рекордов). */
export function whenText(day: string, today: string): string {
  const w = recordWhen(day, today);
  const text = w.kind === 'weekday' ? ru.base.when.weekday[w.weekday] ?? '' : w.kind === 'date' ? fill(ru.base.when.date, { day: w.day, month: w.month }) : w.kind === 'today' ? ru.map.today : ru.base.when.yesterday;
  return fill(ru.base.record, { when: text });
}

/** Название игры на карточке и в доске рекордов: у закрытой — короткое, без клавиш («Вратарь», а не «Вратарь ФЫВА ОЛДЖ»): клавиши показываем, когда игра открыта. */
export function funName(id: FunId, locked: boolean): string {
  const f: { name: string; closedName?: string } = ru.base.fun[id];
  return locked ? (f.closedName ?? f.name) : f.name;
}

/** Условие открытия закрытой игры на интерес: «откроется после урока N» или «с первого матча Кубка». */
export function lockText(id: FunId): string {
  const rule = FUN_GAMES.find((g) => g.id === id)?.open;
  return rule?.kind === 'cup' ? ru.base.lock.cup : fill(ru.base.lock.lesson, { n: rule?.after ?? 0 });
}

/**
 * Охрана адреса `/base/:game` (067 К-Д, Б-З4): игра на интерес — только открытая (`open`: веха, лимит дня и матч дня уже в `baseView`);
 * учебная — только играемая окном (`openLearn`), её адрес ведёт на Базу с окном; всё остальное — на Базу.
 */
export type Gate = { kind: 'fun'; id: FunId } | { kind: 'learn'; id: string } | { kind: 'base' };

/** Игра из адреса `/base/<игра>`; не такой адрес — `undefined`. Стенд кадров открывает экран не через роутер игры, параметра маршрута там нет — берёт игру отсюда (067 Т19). */
export const gameOfPath = (path: string): string | undefined => /^\/base\/([^/?#]+)/.exec(path)?.[1];

export function gameGate(id: string, view: BaseView, learnCtx: LearnCtx): Gate {
  const fun = view.fun.find((f) => f.id === id);
  if (fun !== undefined) return fun.open ? { kind: 'fun', id: fun.id } : { kind: 'base' };
  return openLearn(id, 'base', learnCtx, 0) === null ? { kind: 'base' } : { kind: 'learn', id };
}

/** Что окну учебной игры нужно на старте на Базе (то же, что `BreakEntry` перерыва, без «Ещё игры»: на Базе её нет). */
export interface BaseEntry {
  flow: LearnFlow;
  before: { step: Step; best: number | null };
  stake: number;
}

/** Открыть учебную игру окном над Базой; `null` — сеанс не `ok` (записать некуда) или игра не играется (закрыта, не собирается, не Т17). */
export function enterBase(sections: Sections, ok: boolean, f: EntryFacts, seed: number, game: string): BaseEntry | null {
  if (!ok) return null;
  const ctx = breakCtx(sections, f);
  const flow = openLearn(game, 'base', ctx, seed);
  if (flow === null) return null;
  const learn = learnRead(sections).learn;
  return { flow, before: beforeOf(learn, game), stake: stakeOf(ctx, learn, game) };
}

/**
 * Строка доски рекордов (036-Р2, Э4.08): `lock` — игра закрыта, `none` — рекорда нет, `rec` — рекорд с полосой «последняя игра к рекорду» (`fill`, 0…100)
 * и подписью: последняя — рекорд (`record`; в день рекорда — `today`) или «в прошлый раз N · до рекорда gap» (`gap`).
 */
export interface BoardRow {
  id: FunId;
  kind: 'lock' | 'none' | 'rec';
  better: 'high' | 'low';
  fill: number;
  note: { kind: 'record' | 'today' } | { kind: 'gap'; last: number; gap: number } | null;
}

export function boardRows(view: BaseView, today: string): BoardRow[] {
  return view.fun.map((f): BoardRow => {
    const better = FUN_GAMES.find((g) => g.id === f.id)?.better ?? 'high';
    const rec = f.record;
    if (f.wait === 'later') return { id: f.id, kind: 'lock', better, fill: 0, note: null };
    if (rec === null) return { id: f.id, kind: 'none', better, fill: 0, note: null };
    if (f.lastRecord) return { id: f.id, kind: 'rec', better, fill: 100, note: { kind: rec.day === today ? 'today' : 'record' } };
    const last = f.last?.n ?? 0;
    const ratio = better === 'low' ? (last > 0 ? rec.n / last : 0) : rec.n > 0 ? last / rec.n : 0;
    return { id: f.id, kind: 'rec', better, fill: Math.max(0, Math.min(100, Math.round(ratio * 100))), note: f.last === null ? null : { kind: 'gap', last, gap: Math.abs(last - rec.n) } };
  });
}

/** Метка первого входа на Базу в разделе `seen.firsts` (реплика тренера только на первом входе, 036-Р11). */
export const COACH_FIRST = 'base';

/** Реплику тренера ещё не видели — показать. Нет раздела `seen` — как у нового игрока: показать. */
export const coachDue = (sections: Sections): boolean => ((sections?.[seenDef.name]?.data as Seen | undefined) ?? seenDef.empty()).firsts[COACH_FIRST] === undefined;

/** Патч раздела `seen` после показа реплики; `null` — писать нечего (уже видели или места в `firsts` нет). */
export function seeCoach(sections: Sections, day: string): { seen: Seen } | null {
  const seen = (sections?.[seenDef.name]?.data as Seen | undefined) ?? seenDef.empty();
  if (seen.firsts[COACH_FIRST] !== undefined || Object.keys(seen.firsts).length >= FIRSTS_MAX) return null;
  return { seen: { ...seen, firsts: { ...seen.firsts, [COACH_FIRST]: day } } };
}

/**
 * Итог игры на интерес в сохранение: `finishFun` (рекорд, счётчик дня, 0 монет) и один патч раздела `base`. Повтор того же `run` и закрытая игра —
 * без записи (`null` / `'closed'`); отказ сеанса — `'unsaved'` (итог показан, лимит не потрачен). Монет нет: кошелёк не трогаем (Б-З2).
 */
export function recordFun(sections: Sections, save: (patch: Record<string, unknown>) => { ok: boolean }, result: FunResult, day: string): FunFinish['view'] | 'unsaved' {
  const done = finishFun({ base: baseOf(sections) }, result, { day });
  if (done.view === null || done.view === 'closed') return done.view;
  return save({ base: done.save.base }).ok ? done.view : 'unsaved';
}

const NOTICE = ru.frame.notice as unknown as Record<string, string>;

/**
 * Причина отказа записи словами сеанса — к строке «Итог игры не записан.»: другая вкладка, новая версия, нет места. Сеанс `ok`, а запись не легла —
 * места нет (`quota`); `null` — отказа нет, текста нет.
 */
export function failWhy(status: Status | null): string {
  if (status === null) return '';
  if (status === 'busy') return ru.frame.notice.busyAnon;
  return NOTICE[status === 'ok' ? 'quota' : status] ?? '';
}
