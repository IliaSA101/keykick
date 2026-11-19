/**
 * Вид учебной игры без Vue (067 Т17): ступени в колонке, прогресс, время, ставка, что показать на промахе, расстановка «Точного паса».
 * Чистые функции: числа и состояние приходят из `LearnFlow`, часы — снаружи. Тексты — в `ru.learn` (экран подставляет).
 */
import cfg from '../../content/learn.json';
import type { FormsGame, FormsTask } from '../../engine/learn/forms';
import { isFormsGame } from '../../engine/learn/forms';
import { GAMES, gameOf, type LearnCtx } from '../../engine/learn/queue';
import { rateHundredths } from '../../engine/learn/rate';
import type { Learn } from '../../engine/learn/section';
import { STEP } from '../../engine/learn/games/arrows';
import type { Pt } from '../../engine/learn/games/common';
import type { MouseState } from '../../engine/learn/games/mouse';
import { stepOf, type Step } from '../../engine/learn/steps';
import { createRandom, shuffle } from '../../engine/random';
import { ru } from '../../i18n/ru';
import { fill } from '../home/texts';
import { formsMissText } from './formsMiss';
import { isFormsInput, isFormsPlay, type GameInput, type LearnFlow, type Place, type PlayState } from './run';

/** Соотношение сторон арены (320 × 562 в макете Э8): от него зависит расстановка «Точного паса». */
export const ARENA_ASPECT = 320 / 562;

/** «0:21»: целые секунды, минуты без нуля впереди. */
export function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export type TierState = '' | 'now' | 'got' | 'lost';
export type Ladder = readonly [TierState, TierState, TierState];

/** Ступени в игре (057-Р12): одна «лучшая ещё достижимая» с обводкой, потерянные — с «✗»; «взято» в игре не бывает. */
export function playLadder(misses: number): Ladder {
  return [misses > 1 ? 'now' : '', misses === 1 ? 'now' : misses > 1 ? 'lost' : '', misses > 0 ? 'lost' : 'now'];
}

/** Ступени на итоге: взятая — зелёная, выше неё — потеряны. */
export function endLadder(tier: Step): Ladder {
  const one = (k: 1 | 2 | 3): TierState => (k === tier ? 'got' : k > tier ? 'lost' : '');
  return [one(1), one(2), one(3)];
}

/** Прогресс: индекс текущего шага (с нуля) и сколько всего; подпись «N из M» — `min(at + 1, total)`. */
export function progressOf(p: PlayState): { at: number; total: number } {
  if (p.game === 'arrows') return { at: p.s.field, total: cfg.play.arrows.defenders.length };
  if (p.game === 'mouse') return { at: p.s.at, total: p.s.steps.length };
  if (p.game === 'tab') return { at: p.s.passes, total: cfg.play.tab.passes };
  if (isFormsPlay(p)) return { at: p.s.round, total: p.s.tasks.length };
  return { at: p.s.placed.length, total: p.s.tray.length };
}

/** Название игры по id (`ru.learn.games`); нет такой — пусто. Одно место для окна, перерыва и экрана матча. */
export function gameName(id: string): string {
  return (ru.learn.games as unknown as Record<string, { name: string } | undefined>)[id]?.name ?? '';
}

/** Ставка игры в целых монетах сейчас (ТЗ-3.3): остаток копилки уже учтён, как в `finishLearn`; игра на золоте — 0 (на рекорд монет нет, 057-Р9). */
export function stakeOf(ctx: Pick<LearnCtx, 'speeds'>, learn: Learn, game: string): number {
  const def = GAMES.find((g) => g.id === game);
  if (def === undefined || gameOf(learn, game).step === 3) return 0;
  return Math.floor(((learn.rest ?? 0) + rateHundredths(ctx.speeds, def.norm)) / 100);
}

/** Главная кнопка итога: в перерыве — к «Второму тайму», на Базе — «Ещё раз» (матч с Базы не начинается). */
export const endPrimary = (place: Place): 'second' | 'again' => (place === 'break' ? 'second' : 'again');

/** Игра, как её знал ребёнок до сегодняшнего запуска: ступень и лучшее время. */
export function beforeOf(learn: Learn, game: string): { step: Step; best: number | null } {
  const g = gameOf(learn, game);
  return { step: g.step as Step, best: g.best };
}

export type MissKind = 'arrowsWall' | 'arrowsEdge' | 'arrowsWorse' | 'mouseClick' | 'mouseDrop' | 'tabWrong' | 'tabPast' | 'tabAway' | 'tabMouse' | 'keyboard' | 'formsWrong' | 'formsLink';

/** Что стряслось на промахе: ключ строки полосы и место отметки на арене (клетка, точка в процентах, номер). */
export interface Miss {
  kind: MissKind;
  num?: number;
  /** Готовая строка полосы (игры 5–8: конкретная причина); нет — строка по `kind` из `ru.learn.miss`. */
  text?: string;
  at?: Pt;
  from?: Pt;
}

/** Промах, которым закончился этот ввод; `null` — промаха не было. Отметка живёт до следующего ввода (экран держит её сам). */
export function missOf(before: PlayState, after: PlayState, input: GameInput): Miss | null {
  if (after.s.misses === before.s.misses) return null;
  if (before.game === 'arrows' && input.game === 'arrows') {
    const b = before.s;
    const to = { x: b.ball.x + STEP[input.dir].x, y: b.ball.y + STEP[input.dir].y };
    if (after.game === 'arrows' && (after.s.ball.x !== b.ball.x || after.s.ball.y !== b.ball.y)) return { kind: 'arrowsWorse', at: to };
    return { kind: b.defenders.some((d) => d.x === to.x && d.y === to.y) ? 'arrowsWall' : 'arrowsEdge', at: to };
  }
  if (before.game === 'mouse' && input.game === 'mouse') {
    const step = before.s.steps[before.s.at];
    return input.input.type === 'click' ? { kind: 'mouseClick', at: input.input.at } : { kind: 'mouseDrop', at: input.input.at, ...(step?.ball ? { from: step.ball } : {}) };
  }
  if (before.game === 'tab' && input.game === 'tab') {
    const b = before.s;
    const num = (i: number): number => b.numbers[i] ?? 0;
    if (input.input === 'click') return { kind: 'tabMouse' };
    if (input.input === 'enter') return { kind: 'tabWrong', num: num(b.focus) };
    return b.focus === b.target ? { kind: 'tabPast', num: num(b.target) } : { kind: 'tabAway', num: num(b.target) };
  }
  if (isFormsInput(input)) {
    const text = before.game === input.game && isFormsPlay(before) ? formsMissText(before.s, input.action) : null;
    return { kind: input.action.type === 'link' ? 'formsLink' : 'formsWrong', ...(text === null ? {} : { text }) };
  }
  return { kind: 'keyboard' };
}

/** Кто задаёт вопрос на арене игр 5–8 (портрет и подпись, 057-Р19): «Тренер» — «Отбор» и «Пары», «Судья» — «Табло» и «Заявка». */
export const FORMS_WHO: Record<FormsGame, 'coach' | 'ref'> = { squad: 'coach', pairs: 'coach', board: 'ref', roster: 'ref' };

/** Вопрос раунда игр 5–8: фраза `ru.learn.forms` по ключу `text` задачи с её подстановками (движок русского не знает). */
export const formAsk = (task: FormsTask): string => fill((ru.learn.forms as Record<string, string>)[task.text] ?? '', task.args);

/** Подсказка раунда под заголовком окна игр 5–8: по ключу `text` задачи (`ru.learn.formsHint`), подстановки — аргументы задачи. */
export const formHint = (task: FormsTask): string => fill((ru.learn.formsHint as Record<string, string>)[task.text] ?? '', task.args);

/** Игрок на арене «Точного паса»: цель, партнёр-обманка или соперник. */
export interface Spot extends Pt {
  num: number;
  foe: boolean;
}

/** Номера партнёров: как в Коллекции — 2…10 без 7 (номер ребёнка), по одному на шаг игры. */
const PARTNERS = [2, 3, 4, 5, 6, 8, 9, 10] as const;
const near = (a: Pt, b: Pt, aspect: number, gap: number): boolean => Math.hypot(a.x - b.x, (a.y - b.y) * aspect) < gap;

/**
 * Расстановка шага «Точного паса»: цель с номером, мяч (на переносе) и обманки — двое партнёров и трое соперников, не ближе
 * `gap` процентов ширины к цели, мячу и друг к другу (иначе щелчок по обманке попал бы в радиус цели). Всё по зерну: шаг выглядит одинаково при перерисовке.
 */
export function mouseView(seed: number, s: MouseState): { target: Spot; ball: Pt | null; decoys: Spot[] } {
  const step = s.steps[Math.min(s.at, s.steps.length - 1)];
  const nums = shuffle(createRandom(seed), PARTNERS);
  const target: Spot = { x: step?.target.x ?? 50, y: step?.target.y ?? 50, num: nums[s.at % nums.length] ?? 2, foe: false };
  const ball = step?.ball ?? null;
  const rnd = createRandom(seed * 7 + s.at + 1);
  const decoys: Spot[] = [];
  const gap = 12;
  for (let i = 0; i < 80 && decoys.length < 5; i++) {
    const p = { x: 8 + Math.floor(rnd() * 85), y: 12 + Math.floor(rnd() * 76) };
    if (near(p, target, s.aspect, gap) || (ball !== null && near(p, ball, s.aspect, gap)) || decoys.some((d) => near(p, d, s.aspect, gap))) continue;
    const foe = decoys.length >= 2;
    decoys.push({ ...p, num: foe ? 0 : (nums[(s.at + decoys.length + 1) % nums.length] ?? 3), foe });
  }
  return { target, ball, decoys };
}

/** Итог для показа: ступень, монеты, время; игра, уже взятая на золото, — «на рекорд» (057-Р9, Р18). */
export interface EndModel {
  tier: Step;
  coins: number;
  ms: number;
  best: number;
  record: boolean;
  misses: number;
  /** Золото уже было до этой игры: монет нет, главное — рекорд. */
  goldRepeat: boolean;
  /** Прошлый рекорд времени (до этой игры). */
  was: number | null;
}

/** `null` — игра не доделана (итога нет). Нет записи (`view`) — ступень по запуску, монет нет. */
export function endOf(flow: LearnFlow, before: { step: Step; best: number | null }): EndModel | null {
  const run = flow.run;
  if (run === null || run.ms === null) return null;
  const v = flow.view;
  const tier = v?.step ?? stepOf(run) ?? 1;
  return { tier, coins: v?.coins ?? 0, ms: run.ms, best: v?.best ?? run.ms, record: v?.record ?? false, misses: run.misses, goldRepeat: before.step === 3, was: before.best };
}

/** Строки итога игры (LearnEnd и карточка «после игры» в перерыве): заголовок «Имя: ступень», что получилось и что дальше. */
export function endLines(end: EndModel, name: string, goldTime: string): { title: string; sub: string; note: string } {
  const t = ru.learn.end;
  const title = t.title.replace('{name}', name).replace('{tier}', ru.school.medal[end.tier] ?? '');
  const n = String(end.misses);
  const sub = end.tier === 3 ? (end.was === null || !end.record ? t.doneGoldFirst : t.doneGold.replace('{was}', mmss(end.was))).replace('{time}', mmss(end.ms)) : (end.tier === 2 ? t.done : t.doneBronze).replace('{n}', n);
  const note = end.tier === 3 ? (end.goldRepeat ? t.goldDone : t.goldTaken) : end.tier === 2 ? t.toGold.replace('{time}', goldTime) : t.toSilver;
  return { title, sub, note };
}

/** Вид «Школы», который тренирует игра 5–8: ключ слова в `ru.school.kinds`. */
export const SCHOOL_KIND: Record<string, string> = { squad: 'multi', board: 'fields', roster: 'select', pairs: 'match' };

/** Слово вида ответа «Школы» у игры 5–8 для ссылки у названия окна (Э8.14, 22); у игр 1–4 — пусто. */
export const schoolKind = (game: string): string => (SCHOOL_KIND[game] === undefined ? '' : (ru.school.kinds[SCHOOL_KIND[game]] ?? ''));

/** Строка задания над ареной: жирное начало и хвост. */
export function leadOf(f: LearnFlow): { bold: string; rest: string } {
  const p = f.play;
  const g = ru.learn.games;
  if (f.step === 'end') return { bold: '', rest: f.place === 'base' ? ru.learn.end.leadBase : ru.learn.end.leadBreak };
  if (f.step === 'start' || p === null) return { bold: '', rest: (g as unknown as Record<string, { how: string } | undefined>)[f.game]?.how ?? '' };
  if (p.game === 'arrows') return { bold: g.arrows.taskBold.replace('{n}', String(p.s.defenders.length)), rest: g.arrows.taskRest };
  if (p.game === 'mouse') {
    const num = String(mouseView(f.seed, p.s).target.num);
    return p.s.steps[p.s.at]?.kind === 'carry' ? { bold: g.mouse.carryBold, rest: g.mouse.carryRest.replace('{num}', num) } : { bold: '', rest: g.mouse.click.replace('{num}', num) };
  }
  if (p.game === 'tab') return { bold: '', rest: g.tab.task.replace('{num}', String(p.s.numbers[p.s.target] ?? '')) };
  if (isFormsPlay(p)) return { bold: '', rest: formHint(p.s.tasks[Math.min(p.s.round, p.s.tasks.length - 1)]!) };
  return { bold: '', rest: g.keyboard.task.replace('{letters}', p.s.tray.filter((l) => !p.s.placed.includes(l)).map((l) => l.toUpperCase()).join(' ')) };
}

/** Нажатие клавиши окна: что нужно знать для разбора (без DOM). `plainButton` — фокус на кнопке, кроме главной. */
export interface KeyPress {
  key: string;
  repeat: boolean;
  shift: boolean;
  plainButton: boolean;
}
/** Что делает окно по клавише: закрыться, подать ввод игре или нажать главную кнопку шага. */
export type KeyAction = { do: 'close' } | { do: 'primary' } | { do: 'feed'; input: GameInput };

const DIRS: Record<string, 'left' | 'up' | 'right' | 'down'> = { ArrowLeft: 'left', ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down' };

/**
 * Разбор клавиши окна игры. `null` — окно событие не трогает (пусть идёт дальше). Открытый список внутри окна («Заявка»)
 * забирает Esc и Enter себе (закрыть меню, выбрать строку): одно условие для обеих клавиш.
 */
export function keyAction(step: LearnFlow['step'], game: string, k: KeyPress, listOpen: boolean): KeyAction | null {
  if (listOpen) return null;
  if (k.key === 'Escape') return { do: 'close' };
  if (k.key === 'Enter') {
    if (step === 'play') {
      if (k.repeat) return null;
      if (game === 'tab') return { do: 'feed', input: { game: 'tab', input: 'enter' } };
      return isFormsGame(game) ? { do: 'feed', input: { game, action: { type: 'submit' } } } : null;
    }
    return k.plainButton ? null : { do: 'primary' };
  }
  if (step !== 'play') return null;
  const dir = DIRS[k.key];
  if (game === 'arrows' && dir) return { do: 'feed', input: { game: 'arrows', dir } };
  if (game === 'tab' && k.key === 'Tab') return { do: 'feed', input: { game: 'tab', input: k.shift ? 'shiftTab' : 'tab' } };
  return null;
}
