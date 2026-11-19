/**
 * Общее у игр на интерес на экране (067 Т19, Т20): клавиша события по `e.code`, итог партии (рекорд, «осталось сегодня», запись),
 * строка итога, метка «видел», «Сегодня: игра N из 2». Чистые функции: часы, зерно, день и разделы приходят снаружи.
 * Правил игры здесь нет: ход — в `engine/base/games/*`, рекорд и счётчик дня — `finishFun`. Чеканка и Мемори берут отсюда одно и то же.
 */
import { markSeen } from '../../engine/base/finish';
import { FUN_PER_DAY, spentOn, type FunId } from '../../engine/base/open';
import { judge, type RecordKind } from '../../engine/base/records';
import type { Base, FunRecord } from '../../engine/base/section';
import { clubDef, type Club } from '../../engine/club/section';
import { rivalOf } from '../../engine/cup/teams';
import { isLetter } from '../../engine/typing/keymap';
import { keymap } from '../../engine/typing/layouts';
import { ru } from '../../i18n/ru';
import { fill, rivalName } from '../home/texts';
import { baseOf, failWhy, recordFun, unitOf } from './run';

type Sections = Parameters<typeof baseOf>[0];

const LAYOUT = 'jcuken-win';

/** Раздел сеанса по описанию (`baseDef`, `clubDef`…); нет раздела — пустой. */
export const dataOf = <T>(sections: Sections, def: { name: string; empty: () => T }): T => (sections?.[def.name]?.data as T | undefined) ?? def.empty();

/** Клуб из сеанса: цвета формы, имя и номер на спине. */
export const clubOf = (sections: Sections): Club => dataOf<Club>(sections, clubDef);

/** Подпись бьющего у Вратаря: «бьёт двор на <улица>» — соперник урока `lesson` (067-Р232), пробел после «двор» неразрывный. */
export const strikerText = (lesson: number): string => fill(ru.base.keeper.striker, { rival: rivalName(rivalOf(lesson).street) });

/** Буквы выученных клавиш урока (знаки и пробел не берём): буквы над мячом Чеканки, на картах Мемори, в секторах Вратаря. */
export const lessonLetters = (lessonKeys: string): string[] => [...new Set([...lessonKeys.toLowerCase()].filter(isLetter))];

/**
 * Символ нажатой клавиши: по месту клавиши (`code`) в русской раскладке — ответ не зависит от включённой раскладки (как у матча);
 * места нет в карте, символ не из нужных (`wanted`) или это служебная клавиша — `null`. Модификаторы и повтор удержанной клавиши — не нажатие.
 */
export function pressedChar(e: { code: string; repeat?: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean }, wanted: (ch: string) => boolean): string | null {
  if (e.repeat === true || e.ctrlKey === true || e.altKey === true || e.metaKey === true) return null;
  const ch = keymap.byCode.get(e.code)?.chars?.[LAYOUT]?.[0];
  return ch !== undefined && wanted(ch) ? ch : null;
}

/** Фаза экрана игры на интерес: старт · игра · итог. */
export type Phase = 'start' | 'play' | 'end';

const SEED_MOD = 2147483647;
/** Зерно из часов страницы (`now`, мс) и предыдущего зерна: часы и случайность движку даёт только экран. */
export const rollSeed = (now: number, prev: number): number => (now + prev) % SEED_MOD;
/** Зерно первой партии экрана. Кадр стенда (`stand`) несёт своё: то, что экран показал на старте (состав, слова), игра раздаст по тому же зерну — кадр совпадает с игрой (067-Р261). */
export const firstSeed = (stand: number | undefined, now: number): number => stand ?? rollSeed(now, 0);
/** Партия берёт зерно, разыгранное заранее (`next`): превью старта строится по нему же (Р261); зерно следующей партии — из него. */
export const takeSeed = (next: number, now: number): { seed: number; next: number } => ({ seed: next, next: rollSeed(now, next) });

/**
 * Начинает ли Enter новую партию (на старте — «Играть», на итоге — «Ещё раз»). Нет: клавишу держат (`repeat`), фокус на кнопке
 * (Enter нажмёт её сам), идёт игра. На итоге ещё: игры дня остались (`left > 0`, иначе партия не запишется — Б-З1) и прошла пауза
 * `delay` с показа итога (`openedAt`, `now` — часы страницы): Enter сразу после последнего хода не начинает новую игру.
 */
export function canBegin(o: { phase: Phase; left: number; repeat: boolean; onButton: boolean; openedAt: number; now: number; delay: number }): boolean {
  if (o.repeat || o.onButton) return false;
  if (o.phase === 'start') return true;
  return o.phase === 'end' && o.left > 0 && o.now - o.openedAt >= o.delay;
}

/** Итог доигранной партии для окна итога. */
export interface FunEnd {
  score: number;
  /** `first` и `beaten` — новый рекорд; `same` — рекорд не побит. */
  record: RecordKind;
  /** Рекорд после игры и до неё (0 — рекорда не было). */
  best: number;
  prev: number;
  /** Сколько игр на интерес осталось сегодня после этой. */
  left: number;
  /** Сеанс не записал итог: показан, лимит дня не потрачен. */
  unsaved: boolean;
  /** Игры со временем (Штрафной): время этой серии, рекорд после игры и до неё — целые секунды; у остальных игр нет. */
  t?: number;
  bestT?: number;
  prevT?: number;
}

/** Новый рекорд — только записанный: итог без записи (`unsaved`) рекорда не ставит ни значком, ни подписью на спине, ни радостью. */
export const isRecord = (end: FunEnd): boolean => end.record !== 'same' && !end.unsaved;

/**
 * Строка итога под счётом. Итог не записан (`unsaved`: другая вкладка, нет места) — только «Итог игры не записан.» и причина сеанса `why`:
 * ни «побил рекорд», ни «до рекорда» (рекорд не менялся), как у учебных игр (067-Р112). Иначе — рекорд первый · побит · не побит и «монет нет».
 * Строки — общие у игр на интерес (в блоке Чеканки); «до рекорда» — разность по модулю: у Мемори рекорд — меньше ходов.
 * Первый рекорд: игра отдаёт `unit` (единица счёта в нужном склонении, «хода») — строка с числом, как на кадре Э4.33 (067-Р225 «б»);
 * без `unit` — строка без числа (Чеканка, кадр Э4.29).
 */
export function endNote(end: FunEnd, why: string, unit?: string): string {
  const t = ru.base.keepy;
  if (end.unsaved) return `${ru.learn.end.saveFail} ${why}`.trim();
  const first = unit === undefined ? t.first : fill(t.firstScore, { n: end.score, unit });
  const gap = Math.abs(end.best - end.score);
  // счёт равен рекорду (разность 0) — «До рекорда 0.» не пишем
  const line = end.record === 'first' ? first : end.record === 'beaten' ? fill(t.beaten, { n: end.prev }) : gap === 0 ? '' : fill(t.short, { n: gap });
  return `${line} ${t.noCoins}`.trim();
}

/** Метка «новое» снимается, когда ребёнок открыл экран игры (`markSeen`); писать нечего — `null`. */
export function seenPatch(sections: Sections, id: string): { base: Base } | null {
  const base = baseOf(sections);
  const next = markSeen(base, id);
  return next === base ? null : { base: next };
}

/** Рекорд игры `id` из раздела Базы; рекорда нет — `null`. */
export const bestOf = (sections: Sections, id: FunId): FunRecord | null => baseOf(sections).records[id] ?? null;

/** Рекорд игры на карточке «Рекорд»: «N хода» в склонении игры или «рекорда нет» (067 Т21: общее у Чеканки, Мемори, Вратаря, Мини-футбола). */
export const bestLine = (id: FunId, best: FunRecord | null): string => (best === null ? ru.base.recordNone : `${best.n} ${unitOf(id, best.n)}`);

/**
 * Строка итога игры `id` под счётом: `endNote` с единицей счёта в склонении игры (`withUnit`: первый рекорд «теперь он твой: 22 хода»)
 * или без неё (Чеканка, Мини-футбол — кадры Э4.29, Э4.24). Итога нет — пустая строка. `status` — состояние сеанса (причина «не записан»).
 */
export const endLine = (id: FunId, end: FunEnd | null, status: Parameters<typeof failWhy>[0], withUnit: boolean): string =>
  end === null ? '' : endNote(end, failWhy(status), withUnit ? unitOf(id, end.score) : undefined);

/** Строка «Сегодня: игра N из 2»: N — сыграно сегодня + 1, не больше лимита. */
export const dayLine = (sections: Sections, day: string): { n: number; of: number } => ({ n: Math.min(FUN_PER_DAY, spentOn(baseOf(sections), day) + 1), of: FUN_PER_DAY });

/**
 * Исходы ударов серии (`true` — удар удался: сейв, гол): сравнивает состояние до и после шага движка — удар сменился (или серия кончилась) — прошлый кончился,
 * `hit` — он удался. Шаг без смены удара ряд не меняет. Общее у Вратаря и Штрафного: ряд точек «удар за ударом» на панели.
 */
export function seriesResults(res: readonly boolean[], prev: { shot: number; over: boolean }, next: { shot: number; over: boolean }, hit: boolean): boolean[] {
  const ended = next.shot > prev.shot || (next.over && !prev.over);
  return ended ? [...res, hit] : [...res];
}

/**
 * Ряд точек серии «удар за ударом» на панели (Вратарь и Штрафной): сыгранные — `hit` (удался) или `miss`, текущий удар — `now` (только пока идёт игра),
 * остальные — пустые. Классы точек — у экрана (`save`/`goal`).
 */
export function seriesPips(results: readonly boolean[], total: number, playing: boolean, hit: string): string[] {
  return Array.from({ length: total }, (_, i) => (i < results.length ? (results[i] ? hit : 'miss') : i === results.length && playing ? 'now' : ''));
}

/**
 * Записать итог партии игры `id`: `score` — счёт, `run` — зерно партии (повтор той же записи ничего не меняет). `t` — время серии в секундах
 * (игры со временем: при равном счёте рекорд — меньшее время, `judge`).
 * Лимит дня исчерпан или повтор — итог без записи: экран показывает счёт, рекорд — по прежнему рекорду.
 */
export function finishGame(id: string, sections: Sections, save: (patch: Record<string, unknown>) => { ok: boolean }, score: number, run: string, day: string, t?: number): FunEnd {
  const before = baseOf(sections);
  const prev = before.records[id]?.n;
  const prevT = before.records[id]?.t;
  const view = recordFun(sections, save, { id, score, run, ...(t === undefined ? {} : { t }) }, day);
  const wrote = view !== null && view !== 'closed' && view !== 'unsaved';
  const record = view === 'closed' || view === null ? 'same' : judge(id, score, prev, t, prevT);
  return {
    score,
    record,
    best: record === 'same' ? (prev ?? 0) : score,
    prev: prev ?? 0,
    left: Math.max(0, FUN_PER_DAY - spentOn(before, day) - (wrote ? 1 : 0)),
    unsaved: view === 'unsaved',
    ...(t === undefined ? {} : { t, bestT: record === 'same' ? (prevT ?? 0) : t, prevT: prevT ?? 0 }),
  };
}
