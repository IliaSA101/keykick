/**
 * Ход матча для экрана: разминка (удары по пустым воротам, без штрафа; удар — блок из нескольких
 * коротких строк; строка кончилась — курсор сам на следующей) → первый тайм из 6 атак →
 * перерыв с мини-игрой → второй тайм (подстроен под ошибки первого) → итог матча.
 * Решающая серия — последние атаки второго тайма, длина и запас — от лиги урока (спека 008: двор — 1 и 2,
 * район и город — 2 и 3 на обе). Атака — строка печати; конец строки — удар по воротам.
 * Пенальти по ходу матча (спека 005): после атаки по плану — фаза penalty, слой с задачей вместо
 * печати; ответ — гол в счёт и монеты (пишутся с таймом), потом пробел — и та же атака заново.
 * Без пауз (04.11): удар — поверх печати, ждём только надписи перед таймом и перед первой атакой
 * решающей серии (008-Р8).
 * Счёт, звёзды и строки — в движке (typing, lessons, match); здесь фазы, таймеры, звук и сохранение.
 * Нажатие приходит уже разобранным (KeyPress): события окна слушает экран.
 */
import { computed, ref, shallowRef } from 'vue';
import { finishCupMatch, type CupMatch, type CupNote } from './cup';
import { decisiveBanner } from './decisiveText';
import { keymap } from './keymap';
import { lessons, wordsRu } from './lessons';
import { progress, recordFirstHalf, recordHalf, recordLessonBest, typingStats } from './progress';
import { screenChanged } from './session';
import { sound } from './sound';
import { tasks } from './tasks';
import { openNow, plan } from './unlocks';
import { makeHalf, makeWarmup, type Lesson } from '../engine/lessons';
import {
  MATCH_HALVES,
  addAttack,
  attackResult,
  emptyScore,
  isDecisive,
  leagueRules,
  lessonPassed,
  matchStats,
  seriesFrom,
  starsFor,
  type AttackResult,
  type MatchScore,
} from '../engine/match';
import {
  penaltyCoins,
  penaltyNow,
  penaltyPlan,
  penaltyReason,
  settleKick,
  type KickResult,
  type MidKick,
  type PenaltyTurn,
} from '../engine/midPenalty';
import { bestNote, lessonBestOf, type BestNote } from '../engine/save';
import { pickQuick, type Task } from '../engine/tasks';
import { emptyStats, isDone, startLine, step, type KeyPress, type TypingState, type TypingStats } from '../engine/typing';
import { featureOpen, milestoneOf, type UnlockId } from '../engine/unlocks';
import { ru } from '../i18n/ru';

/** Сколько горит удар тайма: мяч летит, надпись; печать при этом идёт дальше. */
export const SHOT_MS = 1500;
/** Удар разминки короче: вратаря нет, мяч просто в сетке. */
export const WARMUP_SHOT_MS = 900;
/** Большая надпись перед таймом и перед первой атакой решающей серии. */
export const BANNER_MS = 1300;

/**
 * warmup — разминка; play — тайм; wait — клавиши не принимаются: последний удар перед надписью
 * или концом тайма, сама надпись; penalty — пенальти по ходу матча (буквы в печать не идут);
 * halftime — перерыв с мини-игрой.
 */
export type Phase = 'intro' | 'warmup' | 'wait' | 'play' | 'penalty' | 'halftime' | 'done';

/** Удар на поле: номер (новый — анимация заново, даже поверх прошлого), итог, удар разминки ли. */
export type Shot = { no: number; result: AttackResult; warm: boolean };

export interface MatchSetup {
  lesson: Lesson;
  /** Зерно строк: от часов, каждый матч новый. Движок сам часов не видит. */
  seed: number;
  /** Матч кубка: итог — в раунд кубка, а не в урок. */
  cup: CupMatch | null;
  /** Быстрая проверка (app/matchJump): в сохранение ничего не пишется. */
  preview: boolean;
}

export function textAt(list: readonly string[], i: number): string {
  const text = list[i];
  if (!text) throw new Error(`no line ${i}`);
  return text;
}

export function useMatchFlow({ lesson, seed, cup, preview }: MatchSetup) {
  /** Правила решающей — от лиги урока, не от прогресса игрока (кубок двора у игрока из района — по-дворовому). */
  const rules = leagueRules(lesson.league);
  /** Разминка: удары, у каждого — блок строк, видимых сразу. */
  const warmKicks = makeWarmup(lesson, seed);

  const phase = ref<Phase>('intro');
  const half = ref(1);
  /** Строки текущего тайма; второй тайм строится после первого — под его ошибки. */
  const lines = shallowRef<string[]>(makeHalf(lesson, wordsRu, keymap, seed, typingStats()));
  /** Номер строки: в разминке — номер удара, дальше — атаки тайма. */
  const lineIndex = ref(0);
  /** Строка внутри блока удара разминки. */
  const rowIndex = ref(0);
  const warming = ref(true);
  const warmRows = computed(() => warmKicks[lineIndex.value] ?? []);
  const typing = shallowRef<TypingState>(startLine(textAt(warmKicks[0] ?? [], 0), lesson.layout));
  const score = shallowRef<MatchScore>(emptyScore);
  /** Счётчики первого тайма — для итога матча и секундомера; null — первый тайм ещё идёт. */
  const firstStats = shallowRef<TypingStats | null>(null);
  const firstGoals = ref(0);
  const shot = shallowRef<Shot | null>(null);
  const banner = ref<string | null>(null);
  const stars = ref<1 | 2 | 3>(1);
  const unlocked = ref(false);
  /** Ошибки решающей серии — сумма по её атакам (008-Р12, scoreAttack). */
  const decisiveErrors = ref(0);
  const totalStats = shallowRef<TypingStats>(emptyStats);
  /** Итог раунда кубка для экрана итога; null — обычный матч. */
  const cupNote = shallowRef<CupNote | null>(null);
  /** Рекорд урока для экрана итога (спека 003); null — без зачёта, рекорда не показываем. */
  const record = shallowRef<BestNote | null>(null);
  /** Что открыл матч (спека 002): раунд кубка за урок-веху — в строку итога и кнопку «К сетке кубка». */
  const opened = shallowRef<UnlockId[]>([]);

  /** Пенальти по ходу матча (спека 005): план по зерну — один на матч; открыто — по уроку игрока. */
  const kickPlan = penaltyPlan(seed);
  const penaltiesOn = featureOpen(progress, lessons, plan, 'midPenalty');
  /** Удары текущего тайма; удары первого — после перерыва (пишутся с таймом, 005-Р5). */
  const kicks = shallowRef<readonly MidKick[]>([]);
  const firstKicks = shallowRef<readonly MidKick[]>([]);
  /** Сколько атак было до начала текущего тайма: план смотрит атаки только этого тайма. */
  const halfFrom = ref(0);
  /** Пенальти на экране: повод, итог; задача — рядом. null — пенальти нет. */
  const turn = shallowRef<PenaltyTurn | null>(null);
  const penaltyTask = shallowRef<Task | null>(null);
  /** Удары всего матча — для монет в итоге и чтобы задача не повторилась в матче (005-Р14). */
  const matchKicks = computed(() => (half.value === 1 ? kicks.value : [...firstKicks.value, ...kicks.value]));
  const matchPenaltyCoins = computed(() => penaltyCoins(matchKicks.value));

  /** Полоска хода: в разминке — все строки всех ударов, в тайме — атаки. */
  const rowsTotal = computed(() => (warming.value ? warmKicks.flat().length : lines.value.length));
  const rowsDone = computed(() =>
    warming.value ? warmKicks.slice(0, lineIndex.value).flat().length + rowIndex.value : lineIndex.value,
  );

  const typingNow = computed(() => phase.value === 'warmup' || phase.value === 'play');
  /** Первая строка решающей серии во втором тайме (с 0). */
  const seriesStart = computed(() => seriesFrom(lines.value.length, rules.series));
  const decisive = computed(
    () => !warming.value && isDecisive(half.value, lineIndex.value, lines.value.length, rules.series),
  );
  /** Атака серии с 1 — для подписи «Решающая серия · 1 из 2». */
  const seriesNo = computed(() => lineIndex.value - seriesStart.value + 1);
  /** Первая атака серии: перед ней — надпись и строка без склейки (008-Р8); перед второй — нет. */
  const opensSeries = computed(() => decisive.value && lineIndex.value === seriesStart.value);
  /** Зачёт урока по серии: итог не считает его сам (008-Р14). */
  const passed = computed(() => lessonPassed(decisiveErrors.value, rules));

  /** Строки вокруг текущей: в разминке — блок удара; в тайме — следующая атака, на последней — ничего. */
  const rowsBefore = computed(() => (warming.value ? warmRows.value.slice(0, rowIndex.value) : []));
  const rowsAfter = computed(() => {
    if (warming.value) return warmRows.value.slice(rowIndex.value + 1);
    const next = lines.value[lineIndex.value + 1];
    return next ? [next] : [];
  });

  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let shotTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

  function later(ms: number, then: () => void): void {
    timer = globalThis.setTimeout(then, ms);
  }

  function showBanner(text: string, then: () => void): void {
    banner.value = text;
    phase.value = 'wait';
    later(BANNER_MS, () => {
      banner.value = null;
      then();
    });
  }

  function begin(): void {
    if (phase.value !== 'intro') return;
    phase.value = 'warmup';
  }

  /** Удар поверх печати: новый сменяет недоигранный прошлый, гаснет сам. */
  function kick(result: AttackResult, warm: boolean): void {
    shot.value = { no: (shot.value?.no ?? 0) + 1, result, warm };
    if (result === 'goal') sound.goal();
    else if (result === 'save') sound.save();
    else sound.conceded();
    globalThis.clearTimeout(shotTimer);
    shotTimer = globalThis.setTimeout(() => (shot.value = null), warm ? WARMUP_SHOT_MS : SHOT_MS);
  }

  /** Строка разминки кончилась: следующая строка сразу; конец блока — мяч в пустые ворота, счёт тот же. */
  function nextWarmRow(): void {
    const { stats } = typing.value;
    if (rowIndex.value + 1 < warmRows.value.length) rowIndex.value += 1;
    else {
      kick('goal', true);
      if (lineIndex.value + 1 >= warmKicks.length) return endWarmup();
      lineIndex.value += 1;
      rowIndex.value = 0;
    }
    typing.value = startLine(textAt(warmRows.value, rowIndex.value), lesson.layout, stats, true);
  }

  /** Тайм с чистого листа; ошибки разминки идут только в подстройку (ошибки клавиш), не в счёт и звёзды. */
  function startFirstHalf(keyErrors: TypingStats['keyErrors']): void {
    warming.value = false;
    lineIndex.value = 0;
    typing.value = startLine(textAt(lines.value, 0), lesson.layout, { ...emptyStats, keyErrors });
  }

  /** Последний удар разминки долетает — и надпись «Начинаем тайм!». */
  function endWarmup(): void {
    const keyErrors = typing.value.stats.keyErrors;
    phase.value = 'wait';
    later(WARMUP_SHOT_MS, () => {
      startFirstHalf(keyErrors);
      showBanner(ru.match.kickoff, () => {
        phase.value = 'play';
        sound.whistle();
      });
    });
  }

  /** Задача пенальти сейчас: открыто, план велит, быстрая задача нашлась; иначе null. */
  function penaltyDue(): Task | null {
    if (!penaltiesOn) return null;
    const attacks = score.value.attacks.slice(halfFrom.value);
    const taken = kicks.value.length > 0;
    // Следующая строка из серии — пенальти нет: проверка в движке (008-Р7).
    if (!penaltyNow(kickPlan, half.value, attacks, lines.value.length, taken, seriesStart.value)) return null;
    return pickQuick(tasks, seed + half.value, progress.solvedTasks, matchKicks.value.map((k) => k.taskId));
  }

  /**
   * Пенальти: слой с задачей вместо печати. Текущая строка — заново, без склейки и с прощением
   * первого нажатия (005-Р7): пауза на задачу в секундомер и темп не идёт, руки ушли к цифрам.
   */
  function callPenalty(task: Task): void {
    penaltyTask.value = task;
    turn.value = { taskId: task.id, reason: penaltyReason(half.value), result: null };
    typing.value = startLine(textAt(lines.value, lineIndex.value), lesson.layout, typing.value.stats, false, true);
    phase.value = 'penalty';
    sound.whistle();
  }

  /** Быстрая проверка (app/matchJump): пенальти сейчас, без плана и открытия; taskId — эта задача. */
  function forcePenalty(taskId?: string): void {
    const task = tasks.find((t) => t.id === taskId) ?? pickQuick(tasks, seed + half.value, progress.solvedTasks);
    if (task) callPenalty(task);
  }

  /** Ответ или «Не бить»: засчитывается первый (settleKick), звук — по итогу. */
  function answerPenalty(result: KickResult): void {
    const t = turn.value;
    if (phase.value !== 'penalty' || t === null) return;
    const next = settleKick({ turn: t, kicks: kicks.value, score: score.value }, result);
    if (next.turn === t) return;
    turn.value = next.turn;
    kicks.value = next.kicks;
    score.value = next.score;
    if (result === 'scored') sound.goal();
    else if (result === 'missed') sound.save();
  }

  /** «Пробел — играем дальше»: только после ответа или «Не бить». */
  function resumePlay(): void {
    if (phase.value !== 'penalty' || !turn.value || turn.value.result === null) return;
    turn.value = null;
    penaltyTask.value = null;
    phase.value = 'play';
  }

  /**
   * Счёт атаки (008-Р12): ошибки атаки серии прибавляются к ошибкам серии, атака — в счёт матча.
   * Одна на удар и на быструю проверку (app/matchJump): присваивание вместо суммы теряло 5-ю атаку.
   */
  function scoreAttack(errors: number): void {
    if (decisive.value) decisiveErrors.value += errors;
    score.value = addAttack(score.value, errors);
  }

  /** Атака кончилась: удар, и следующая строка сразу; перед решающей серией и в конце тайма — ждём удар. */
  function shoot(): void {
    const errors = typing.value.lineErrors;
    scoreAttack(errors);
    kick(attackResult(errors), false);
    if (lineIndex.value + 1 >= lines.value.length) {
      phase.value = 'wait';
      later(SHOT_MS, half.value < MATCH_HALVES ? endFirstHalf : finish);
      return;
    }
    lineIndex.value += 1;
    typing.value = startLine(textAt(lines.value, lineIndex.value), lesson.layout, typing.value.stats, !opensSeries.value);
    // Пенальти — после удара: мяч долетает, клавиши не принимаются, потом слой с задачей.
    const task = penaltyDue();
    if (task) {
      phase.value = 'wait';
      later(SHOT_MS, () => callPenalty(task));
      return;
    }
    if (!opensSeries.value) return;
    phase.value = 'wait';
    later(SHOT_MS, () => showBanner(decisiveBanner(rules), () => (phase.value = 'play')));
  }

  /** Свисток на перерыв: первый тайм — сразу в сохранение (пак, голы, ошибки клавиш), потом мини-игра. */
  function endFirstHalf(): void {
    const stats = typing.value.stats;
    firstStats.value = stats;
    firstGoals.value = score.value.goals;
    firstKicks.value = kicks.value;
    if (!preview) recordFirstHalf({ goals: score.value.goals, stats, penalties: kicks.value });
    phase.value = 'halftime';
    sound.whistle(true);
    // Между таймами — тоже «переход экрана»: назначенный режимный перерыв начнётся здесь,
    // а не после всего второго тайма (адрес страницы при этом не меняется).
    if (!preview) screenChanged();
  }

  /**
   * Второй тайм: строки — по ошибкам клавиш, в которые уже вошёл первый тайм.
   * В нём решающая атака: у уроков 1–2 она — ловушка смены букв (спека 003, Т2).
   */
  function setupSecondHalf(): void {
    half.value = MATCH_HALVES;
    warming.value = false;
    lineIndex.value = 0;
    halfFrom.value = score.value.attacks.length;
    kicks.value = [];
    lines.value = makeHalf(lesson, wordsRu, keymap, seed + 1, typingStats(), true);
    typing.value = startLine(textAt(lines.value, 0), lesson.layout);
  }

  /** После перерыва — надпись и второй тайм. */
  function startSecondHalf(): void {
    if (phase.value !== 'halftime') return;
    setupSecondHalf();
    showBanner(ru.match.secondHalf, () => {
      phase.value = 'play';
      sound.whistle();
    });
  }

  function finish(): void {
    const second = typing.value.stats;
    const total = matchStats(firstStats.value ? [firstStats.value, second] : [second]);
    totalStats.value = total;
    stars.value = starsFor(total, decisiveErrors.value, rules);
    const before = progress.lessonIndex;
    const wasOpen = openNow();
    // В сохранение — только второй тайм: первый уже записан до перерыва.
    const result = {
      lessonId: lesson.id,
      stars: stars.value,
      goals: score.value.goals - firstGoals.value,
      stats: second,
      penalties: kicks.value,
    };
    if (cup) cupNote.value = finishCupMatch(cup, result, score.value, decisiveErrors.value, preview);
    else if (!preview) recordHalf(result);
    // Рекорд урока — за оба тайма и в кубке тоже (003-Р4); в быстрой проверке показываем, не пишем.
    const best = lessonBestOf(total);
    record.value = bestNote(progress.lessonBest[lesson.id], best, stars.value);
    if (!preview) recordLessonBest(lesson.id, stars.value, best);
    unlocked.value = progress.lessonIndex > before;
    // Открытое матчем (спека 002): было закрыто до записи, открыто после. Быстрая проверка
    // ничего не пишет — там открытое то, что открывает урок, если он зачтён (кубок уроков не открывает).
    opened.value = preview
      ? (stars.value >= 2 && !cup ? milestoneOf(lesson.id, lessons, plan) : [])
      : openNow().filter((id) => !wasOpen.includes(id));
    phase.value = 'done';
    if (!preview) screenChanged();
    sound.whistle(true);
  }

  /** Нажатие во время печати; вне печати — ничего. */
  function press(p: KeyPress): void {
    if (!typingNow.value) return;
    const next = step(keymap, typing.value, p);
    typing.value = next;
    if (next.last === 'ok') sound.key();
    else if (next.last === 'error') sound.error();
    if (!isDone(next)) return;
    if (warming.value) nextWarmRow();
    else shoot();
  }

  function dispose(): void {
    globalThis.clearTimeout(timer);
    globalThis.clearTimeout(shotTimer);
  }

  return {
    lesson,
    rules,
    seed,
    warmKicks,
    phase,
    half,
    lines,
    lineIndex,
    rowIndex,
    warming,
    typing,
    score,
    firstStats,
    firstGoals,
    shot,
    banner,
    stars,
    unlocked,
    decisiveErrors,
    passed,
    totalStats,
    cupNote,
    record,
    opened,
    kickPlan,
    turn,
    penaltyTask,
    matchPenaltyCoins,
    rowsTotal,
    rowsDone,
    typingNow,
    decisive,
    seriesStart,
    seriesNo,
    opensSeries,
    rowsBefore,
    rowsAfter,
    begin,
    press,
    startFirstHalf,
    endFirstHalf,
    setupSecondHalf,
    startSecondHalf,
    finish,
    scoreAttack,
    forcePenalty,
    answerPenalty,
    resumePlay,
    dispose,
  };
}

export type MatchFlow = ReturnType<typeof useMatchFlow>;
