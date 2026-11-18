/**
 * Ход матча на экране (065 Т9): часы, семя и окна поверх — здесь, снаружи движка (`engine/match`, он чистый).
 * `Run` — матч и вся запись событий (журнал: семя + события, 065-К-В). Окна `overlay` — не больше одного (запрет М5);
 * пока окно открыто, матч стоит на паузе и печать не идёт (запрет М1). Всё — чистые функции, часы приходят параметром.
 */
import { parseDictionary } from '../../engine/plan/dictionary';
import { parseLessons } from '../../engine/plan/parseLessons';
import type { CourseLesson, Dictionary } from '../../engine/plan/lesson';
import { idleMatch, soften, step, type Effect, type MatchEvent, type MatchRules, type MatchState, type RunningMatch, type StartEvent } from '../../engine/match';
import dictionaryRaw from '../../content/dictionary.json';
import type { Pack } from '../../content/schema/pack';
import { keymap } from '../../engine/typing/layouts';

export type Overlay = 'none' | 'pause' | 'quit' | 'help';

export interface Run {
  start: StartEvent;
  state: MatchState;
  /** События после `start`, по порядку прихода. */
  events: readonly MatchEvent[];
  overlay: Overlay;
  /** Окно, из которого открыли справку или выход: Esc возвращает в него (иначе — в матч). */
  below: Overlay;
}

/** Начало матча: урок, семя и правила — снаружи; словарь и карта клавиатуры — сборки. */
export function buildStart(lesson: CourseLesson, seed: number, dict: Dictionary, rules: Partial<MatchRules> = {}, stats?: StartEvent['stats']): StartEvent {
  const start: StartEvent = { type: 'start', seed, rules, lesson, dict, keymap };
  if (stats !== undefined) start.stats = stats;
  return start;
}

/** Уроки пакета лиги и словарь курса — то, что нужно `buildStart` (раскладка и карта — как у пакета). */
export function lessonsOf(pack: Pack, league: string, count: number): CourseLesson[] {
  return parseLessons(pack, { lang: 'ru', layout: 'jcuken-win', keymap, league, lessons: count });
}
/**
 * Урок после паузы ≥ 5 дней (ТЗ-2.11, 065-Р137): «не строже пройденного» — длины и пороги не выше предыдущего урока
 * (`soften`), буквы и материал свои. Звёзды не урезаем: возврат — не помощь (`softened` в итог не идёт).
 */
export function comebackLesson(lessons: readonly CourseLesson[], lesson: CourseLesson): CourseLesson {
  const passed = lessons.find((l) => l.n === lesson.n - 1);
  return passed ? soften(lesson, passed) : lesson;
}
export const dictionaryOf = (): Dictionary => parseDictionary(dictionaryRaw, keymap, 'jcuken-win', 'ru');

export function startRun(start: StartEvent): { run: Run; effects: Effect[] } {
  const out = step(idleMatch, start);
  return { run: { start, state: out.state, events: [], overlay: 'none', below: 'none' }, effects: out.effects };
}

/** Событие движку. Под окном печать и тики не идут (М1): «Второй тайм» и ответ на пенальти — тоже. */
export function feed(run: Run, event: MatchEvent): { run: Run; effects: Effect[] } {
  if (run.overlay !== 'none' && event.type !== 'resume' && event.type !== 'pause') return { run, effects: [] };
  const out = step(run.state, event);
  return { run: { ...run, state: out.state, events: [...run.events, event] }, effects: out.effects };
}

export type UiAction = 'esc' | 'pause' | 'help' | 'quit' | 'resume';

/**
 * Окна поверх матча (запреты М1, М5, М6). `esc`: из паузы — назад в матч; из справки и выхода — в окно под ними.
 * `pause` — только из матча без окна; `help`, `quit` — из паузы или из вступления/перерыва (там окно «под» — пустое).
 * Окно открыто — движок на паузе, закрыто — продолжает (`resume`); холостое действие ничего не меняет.
 */
export function ui(run: Run, action: UiAction): Run {
  const o = run.overlay;
  const next = ((): { overlay: Overlay; below: Overlay } | null => {
    if (action === 'pause') return o === 'none' ? { overlay: 'pause', below: 'none' } : null;
    if (action === 'help' || action === 'quit') return o === action ? null : { overlay: action, below: o === 'help' || o === 'quit' ? run.below : o };
    if (action === 'resume') return o === 'pause' ? { overlay: 'none', below: 'none' } : null;
    if (o === 'none') return { overlay: 'pause', below: 'none' };
    return { overlay: o === 'pause' ? 'none' : run.below, below: 'none' };
  })();
  if (next === null) return run;
  return { ...run, ...next };
}

/** Окно открылось или закрылось — движку `pause`/`resume` (часы не идут на паузе). Запись событий не пополняется: пауза — не игра. */
export function sync(before: Run, after: Run, t: number): Run {
  if ((before.overlay === 'none') === (after.overlay === 'none')) return after;
  const out = step(after.state, after.overlay === 'none' ? { type: 'resume' } : { type: 'pause' });
  void t;
  return { ...after, state: out.state };
}

/** Нажатие браузера → событие движка (время — снаружи). Esc, Enter и Tab в печать не идут: ими управляет экран. */
export interface RawKey {
  code: string;
  key: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  caps?: boolean;
}
export function keyEventOf(e: RawKey, t: number): MatchEvent | null {
  if (e.code === 'Escape' || e.code === 'Tab' || e.code === 'Enter' || e.code === 'NumpadEnter') return null;
  return { type: 'key', code: e.code, key: e.key, t, repeat: e.repeat ?? false, mod: (e.ctrlKey ?? false) || (e.altKey ?? false) || (e.metaKey ?? false), caps: e.caps ?? false };
}

/**
 * Матч стоит на вердикте пенальти (065 Т10б): ответ уже ушёл движку, а лист ещё на экране — пока ребёнок читает, время
 * не идёт. Как `sync`: движку `pause`/`resume`, запись событий не пополняется (пауза — не игра, журнал повторяет матч без неё).
 */
export const hold = (run: Run): Run => (run.state.phase === 'idle' || run.state.paused ? run : { ...run, state: step(run.state, { type: 'pause' }).state });
export const release = (run: Run): Run => (run.state.phase !== 'idle' && run.state.paused ? { ...run, state: step(run.state, { type: 'resume' }).state } : run);

/** Матч закончен свистком (`result`): только тогда экран пишет сохранение (запрет М3). */
export const isWhistle = (run: Run): run is Run & { state: RunningMatch } => run.state.phase === 'result';
