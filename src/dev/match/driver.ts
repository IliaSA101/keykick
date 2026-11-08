/**
 * Витрина матча v2 (спека 017, Т6): строит `MatchState` движка нажатиями до нужной фазы. Только dev-сборка.
 * Тексты — настоящие (`makeCourse*`), часы и зерно — числа здесь; в выпуск файл не попадает.
 */
import matchJson from '../../content/match.json';
import { courseLessons, dictionary } from '../../app/course/load';
import { keymap } from '../../app/keymap';
import { tasks } from '../../app/tasks';
import { makeCourseHalf, makeCourseWarmup, makeExtraAttack } from '../../engine/course/attack';
import type { CourseLesson } from '../../engine/course/model';
import { kickTask } from '../../engine/match/kick';
import { coachLesson } from '../../engine/match/lessonCopy';
import { initMatch, next, type MatchConfig, type MatchState, type MatchTexts } from '../../engine/match/machine';
import { parseMatchRules } from '../../engine/match/rules';
import type { Action } from '../../engine/match/view';
import type { KeyPress } from '../../engine/typing';

export const rules = parseMatchRules(matchJson, keymap);

export function lessonById(id: string | null): CourseLesson {
  return courseLessons.find((l) => l.id === id) ?? courseLessons.find((l) => l.id === 'yard-05') ?? courseLessons[0]!;
}

const textsOf = (l: CourseLesson): MatchTexts => ({
  warmup: (seed) => makeCourseWarmup(l, dictionary, keymap, seed),
  half: (seed, second) => makeCourseHalf(l, dictionary, keymap, seed, undefined, second),
  extra: (seed) => makeExtraAttack(l, dictionary, keymap, seed),
  coachLine: (keys, seed) => makeCourseHalf(coachLesson(l, keys), dictionary, keymap, seed)[0] ?? keys,
});

export const SEED = 11;

export function configOf(l: CourseLesson): MatchConfig {
  return {
    lesson: l, softened: false, kind: 'lesson', best: 0, paid: true, rules, map: keymap, texts: textsOf(l),
    kickTask: (seed, done) => kickTask(tasks, seed, done)?.id ?? null, solved: [],
  };
}

export const startState = (l: CourseLesson, fails = 0): MatchState => initMatch(configOf(l), { seed: SEED, fails });

let clock = 1000;
/** Нажатие: верное знаком строки или заведомо мимо (`ok = false`). */
export function pressOf(ch: string, ok = true): KeyPress {
  clock += 140;
  return {
    code: ok ? (keymap.byChar.ru.get(ch)?.key.code ?? 'KeyA') : 'KeyZ',
    key: ok ? ch : '§',
    repeat: false,
    mod: false,
    caps: false,
    time: clock,
  };
}

const act = (s: MatchState, a: Action): MatchState => next(s, a).state;

/** Сколько ошибок вставить в атаку (фаза, номер атаки с 0) — после первого знака её первой строки. */
export type Policy = (phase: string, half: 1 | 2, attack: number) => number;

/**
 * Играет за ребёнка до `stop`. Пенальти пропускает («Не бить») или решает верно (`kick = 'scored'`), на перерыве идёт во 2-й тайм.
 * Останавливается и на итоге, и если печатать нечего.
 */
export function play(s0: MatchState, stop: (s: MatchState) => boolean, policy: Policy = () => 0, kick: 'skip' | 'scored' = 'skip'): MatchState {
  let s = s0;
  const done = new Set<string>();
  for (let guard = 0; guard < 30000 && !stop(s); guard++) {
    if (s.phase === 'intro') {
      s = act(s, { type: 'start', now: clock });
      continue;
    }
    if (s.phase === 'kick') {
      s = act(s, kick === 'scored' ? { type: 'kickAnswer', result: 'scored' } : { type: 'skipKick' });
      continue;
    }
    if (s.phase === 'break') {
      s = act(s, { type: 'toSecondHalf', now: clock, seed: SEED + 1 });
      continue;
    }
    const t = s.typing;
    if (!t) break;
    const key = `${s.phase}${s.half}${s.attack}`;
    const attackPhase = s.phase === 'half1' || s.phase === 'half2' || s.phase === 'extra';
    if (attackPhase && t.pos === 1 && s.row === 0 && !done.has(key)) {
      done.add(key);
      for (let i = 0; i < policy(s.phase, s.half, s.attack); i++) s = act(s, { type: 'press', press: pressOf('a', false) });
    }
    // Минута тренера кончается по часам: после первого знака перематываем время за её длину.
    if (s.phase === 'coach' && s.coach?.startedAt != null) clock += rules.coach.ms;
    const cur = s.typing;
    if (!cur) break;
    s = act(s, { type: 'press', press: pressOf(cur.text[cur.pos] ?? 'a') });
  }
  return s;
}

/** Сколько ошибок даёт «гол», «сейв» и «гол соперника» на пороге урока. */
export const levels = (l: CourseLesson) => ({ goal: 0, over: l.g + 1, conceded: l.c });

export { act };
