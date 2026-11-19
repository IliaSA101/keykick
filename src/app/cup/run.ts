/**
 * Матч Кубка на экране (068 Т6, К-Б): что играть сейчас, как стартует матч (урок Кубка, доп. время только в плей-офф), как свисток
 * пишет игрока (`finishCup`, раздел `cup`) и что показывает вступление. Чистые функции, часы и случайность — снаружи: тест без браузера.
 * Серия ударов при ничьей в плей-офф (068-Т6-2) — `seriesFlow.ts`; её исход приходит в `finishCupRun` параметром `series`.
 */
import { cupDef, cupLesson, cupPatch, cupView, emptyCup, extraTime, finishCup, ROUND_KEYS, seedOf, TEAMS, type Cup, type CupFact, type CupNext, type CupResultView, type CupSave, type CupView, type RoundKey, type SeriesResult, type Team } from '../../engine/cup';
import type { FormState } from '../../engine/form/rank';
import { isComeback, type StartEvent } from '../../engine/match';
import type { CourseLesson, Dictionary } from '../../engine/plan/lesson';
import { fill } from '../home/texts';
import { ru } from '../../i18n/ru';
import { buildStart, isWhistle, type Run } from '../match/run';
import { afterMatch, type AfterMatch } from '../../engine/day/flow';
import { matchRead, rhythmPatch, type FinishDeps } from '../match/finish';

const t = ru.cup.match;

/** Раунд из адреса `/match?cup=<раунд>`: чужое слово — `null` (матч идёт как обычный урок). */
export const roundOf = (q: unknown): RoundKey | null => ROUND_KEYS.find((r) => r === q) ?? null;

/**
 * Раунд, который можно играть сейчас: открытый или переигровка; ждёт, закрыт, Кубок взят — `null`.
 * `afterTitle` — места, где предлагается повтор после золота (кнопка «Сыграть снова» экрана Кубка, вход в матч): Кубок взят → финал ради монет (ТЗ-8.13, Э5.42).
 * Главная кнопка Дома повтор не предлагает (там `afterTitle` не задан).
 */
export const playableRound = (next: CupNext, afterTitle = false): RoundKey | null => (next.state === 'open' || next.state === 'replay' ? next.round : afterTitle && next.state === 'done' ? 'f' : null);

/** Вид Кубка из входа Дома и игрока: одно место для экрана Кубка, Дома и матча (`HomeInput` → `CupCtx`). */
export const cupViewFor = (cup: Cup, i: { cur: number; day: number; pause5: boolean }, today: string, pid: string): CupView =>
  cupView(cup, { cur: i.cur, day: today, dayN: i.day, pause5: i.pause5, seed: seedOf(pid) });

/** Старт матча Кубка: урок Кубка по якорю раунда (`cupLesson`) и флаг доп. времени (группа — без него). Урока-якоря нет в курсе — `null`. */
export function cupStart(round: RoundKey, anchor: number, lessons: readonly CourseLesson[], form: FormState, seed: number, dict: Dictionary): { lesson: CourseLesson; start: StartEvent } | null {
  const lesson = cupLesson(anchor, lessons, form);
  if (lesson === null) return null;
  return { lesson, start: { ...buildStart(lesson, seed, dict), extra: extraTime(round) } };
}

/** Что показывает вступление и табло матча Кубка (Э5.23–.25, .29): всё готовое, экран не считает. */
export interface CupMatchInfo {
  round: RoundKey;
  team: Team;
  /** «Кубок двора · 1/8 финала · ответный матч». */
  title: string;
  /** Слово у «против»: «дома» или «в гостях». */
  where: string;
  /** Подпись под соперником: «двор на Заречной». */
  teamSub: string;
  /** Правая ячейка табло вступления. */
  board: string;
  /** Правая ячейка табло доп. времени. */
  boardExtra: string;
  rules: string[];
}

const cap = (s: string): string => (s === '' ? s : s[0]!.toUpperCase() + s.slice(1));

/** Вид матча Кубка для раунда `round` по виду Кубка; соперника нет (раунд закрыт) — `null`. `weak` — трудные клавиши, строка правил; `played` — вид строится для итога сыгранного матча: табло называет раунд, а не «ответный матч» (Э5.41). */
export function cupMatchInfo(view: CupView, round: RoundKey, weak: string, played = false): CupMatchInfo | null {
  const item = view.path.find((p) => p.round === round);
  const team = TEAMS.find((x) => x.id === item?.rival);
  if (item === undefined || team === undefined) return null;
  const group = round === 'g1' || round === 'g2' || round === 'g3';
  const name = cap(ru.home.flags[item.flag] ?? '');
  const replay = item.state === 'replay';
  const tail = replay ? ` · ${group ? t.replayGroup : t.replayKo}` : '';
  const letter = view.groups[view.ours]!.letter;
  const lessonLine = weak === '' ? t.lessonLinePlain : fill(t.lessonLine, { keys: [...weak.toUpperCase()].join(' ') });
  // Кубок уже взят (повтор, ТЗ-8.13, Э5.42): первой строкой — что награды не повторяются, дальше правило плей-офф
  const rules = view.title === 'gold' ? [ru.cup.screen.titleNote, t.rules.extra] : group ? [t.rulesGroup.draw, t.rulesGroup.replay, t.rules.noStars] : [t.rules.extra, t.rules.replay, t.rules.noStars];
  return {
    round,
    team,
    title: fill(t.title, { round: `${name}${tail}` }),
    teamSub: fill(ru.home.rival, { street: team.street }),
    where: item.home ? ru.map.home : ru.map.away,
    board: group ? fill(t.boardGroup, { letter, n: ROUND_KEYS.indexOf(round) + 1 }) : replay && !played ? cap(t.replayKo) : fill(t.boardKo, { round: name }),
    boardExtra: fill(t.boardExtra, { round: group ? name : (ru.cup.card.next[round as 'r16' | 'qf'] ?? name) }),
    rules: view.title === 'gold' ? rules : [lessonLine, ...rules],
  };
}

/** Разделы игрока для свистка Кубка: общие разделы свистка и `cup`. */
export function cupRead(sections: Parameters<typeof matchRead>[0]): CupSave {
  const m = matchRead(sections);
  const cup = (sections?.[cupDef.name]?.data as Cup | undefined) ?? emptyCup();
  return { cup, wallet: m.wallet, day: m.day, school: m.school, form: m.form, coach: m.coach, stadium: m.stadium, album: m.album };
}

/** Итог матча Кубка, переданный экрану итога. `after` — раздел `cup` после записи (из него строится таблица и «что дальше»). */
export type CupFinished = { kind: 'cup'; view: CupResultView; facts: CupFact[]; after: Cup; saved: boolean; rhythm?: AfterMatch };

export type CupFinishDeps = Omit<FinishDeps, 'read'> & { read(): CupSave };

/**
 * Свисток матча Кубка → сохранение и журнал: запись только после свистка (запрет М3), повтор с тем же `matchId` — `repeat`, второй записи нет.
 * `series` — исход серии при ничьей в плей-офф (`resultOf`), иначе `null`; ничья плей-офф без серии — поражение раунда (движок).
 */
export function finishCupRun(run: Run, ctx: { now: number; day: string; matchId: string; round: RoundKey }, deps: CupFinishDeps, series: SeriesResult | null = null): CupFinished | { kind: 'none' } | { kind: 'repeat' } {
  if (!isWhistle(run) || run.state.result === null) return { kind: 'none' };
  const before = deps.read();
  const done = finishCup(before, run.state.result, series, ctx);
  if (done.view === null) return { kind: 'repeat' };
  // ритм дня (068-Р71): время печати Кубка уже идёт в день — «Итог дня» на итоге Кубка есть, строки тренера нет (ступени урока у раунда нет)
  const rhythm = deps.readStory === undefined ? undefined : afterMatch(before.day, done.save.day, deps.readStory(), ctx.day, 0, false, true, isComeback(before.day.last, ctx.now));
  const saved = deps.save({ ...cupPatch(done.save), ...rhythmPatch(rhythm) }).ok;
  void deps.journal.put(ctx.matchId, { seed: run.start.seed, events: run.events });
  return { kind: 'cup', view: done.view, facts: done.facts, after: done.save.cup, saved, ...(rhythm === undefined ? {} : { rhythm }) };
}
