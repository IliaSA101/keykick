/**
 * Сцены витрины матча v2: id (латиницей, в адрес и имя PNG) → состояние движка в нужной фазе. Только dev-сборка.
 */
import { courseLessons } from '../../app/course/load';
import type { CourseLesson } from '../../engine/course/model';
import type { MatchState } from '../../engine/match/machine';
import { act, levels, play, SEED, startState, type Policy } from './driver';

type Build = (l: CourseLesson) => MatchState;

/** Печатает, пока в атаке `attack` тайма `half` не набрано `chars` знаков; `errs` ошибок вставлено в неё. */
function midAttack(l: CourseLesson, half: 1 | 2, attack: number, chars: number, errs: number, base: Policy = () => 0): MatchState {
  const policy: Policy = (p, h, a) => (h === half && a === attack ? errs : base(p, h, a));
  return play(
    startState(l),
    (s) => s.half === half && s.attack === attack && s.phase !== 'warmup' && s.row === 0 && (s.typing?.pos ?? 0) >= chars,
    policy,
  );
}

/** Первый тайм: гол, гол соперника, гол, гол соперника → 2:2 и в 1-м, и во 2-м тайме → ничья. */
const evenly = (l: CourseLesson): Policy => (_p, _h, a) => (a % 2 === 1 ? l.c : 0);

/** До итога (с этим числом провалов до матча), по политике ошибок; пенальти по умолчанию пропускается. */
const toResult = (l: CourseLesson, fails: number, policy: Policy, kick: 'skip' | 'scored' = 'skip'): MatchState =>
  play(startState(l, fails), (s) => s.phase === 'result', policy, kick);

/** Ошибок для «сейва»: между g и c (при c = g + 1 сейва нет — сцена станет голом соперника). */
const saveErrors = (l: CourseLesson): number => Math.min(l.g + 1, l.c - 1);

/** Помощь после провала: «выбор» на итоге и новый матч до итога (проход без ошибок). */
const withHelpPlayed = (l: CourseLesson, failsBefore: number, offer: 'reserve' | 'coach'): MatchState => {
  const loss = toResult(l, failsBefore, () => l.c);
  return play(act(loss, { type: 'choose', offer, seed: SEED + 2, now: 9000 }), (s) => s.phase === 'result');
};

export const scenes: Record<string, Build> = {
  intro: (l) => startState(l),
  warmup: (l) => act(startState(l), { type: 'start', now: 1 }),
  half1: (l) => midAttack(l, 1, 1, 6, 0),
  'reserve-e0': (l) => midAttack(l, 1, 1, 6, 0),
  'reserve-eg': (l) => midAttack(l, 1, 1, 6, l.g),
  'reserve-over': (l) => midAttack(l, 1, 1, 6, levels(l).over),
  decisive: (l) => midAttack(l, 2, l.attacks.length - 1, 6, 0, evenly(l)),
  'decisive-hurt': (l) => midAttack(l, 2, l.attacks.length - 1, 6, 1, evenly(l)),
  half2: (l) => midAttack(l, 2, 0, 6, 0),
  break: (l) => play(startState(l), (s) => s.phase === 'break'),
  kick: (l) => play(startState(l), (s) => s.phase === 'kick', () => 0),
  extra: (l) => play(startState(l), (s) => s.phase === 'extra', evenly(l)),
  // Провал при fails = 1 → минута тренера: все атаки проиграны.
  coach: (l) => play(startState(l, 1), (s) => s.phase === 'coach', () => l.c),
  win: (l) => play(startState(l), (s) => s.phase === 'result'),
  loss: (l) => play(startState(l), (s) => s.phase === 'result', () => l.c),
  // Итоги (Т7): победа ★★★ — «win»; здесь — остальные виды (ТЗ-2.4, 2.6, 2.8, 2.9, 2.11).
  'win-3': (l) => toResult(l, 0, () => 0),
  'win-1': (l) => toResult(l, 0, (_p, h, a) => (h === 1 && a === 0 ? l.c : 0)),
  // Пример ТЗ-2.6: 1:1 печатью + пенальти = 2:1 — пройден, звёзд нет.
  'penalty-pass': (l) =>
    toResult(l, 0, (_p, h, a) => (h === 1 ? (a === 0 ? l.c : saveErrors(l)) : a === 0 ? 0 : saveErrors(l)), 'scored'),
  'loss-1': (l) => toResult(l, 0, () => l.c),
  // 1-й тайм не проигран → «Переиграть 2-й тайм».
  'loss-1-half2': (l) => toResult(l, 0, (_p, h) => (h === 1 ? 0 : l.c)),
  'loss-2': (l) => toResult(l, 1, () => l.c),
  'loss-3': (l) => toResult(l, 2, () => l.c),
  'loss-5': (l) => toResult(l, 4, () => l.c),
  'help-reserve': (l) => withHelpPlayed(l, 2, 'reserve'),
  'help-coach': (l) => withHelpPlayed(l, 4, 'coach'),
  // Товарищеский урок: поражение — всё равно пройден («Урок пройден», вид `passed`, ТЗ-2.6).
  passed: (l) => {
    const friendly = courseLessons.find((x) => x.friendly) ?? l;
    return toResult(friendly, 0, () => friendly.c);
  },
  growth: (l) => toResult(l, 0, () => 0),
  report: (l) => toResult(l, 0, () => 0),
  comeback: (l) => startState(l),
  paused: (l) => act(midAttack(l, 1, 1, 6, 0), { type: 'pause' }),
};

export const sceneIds = Object.keys(scenes);
