/**
 * Быстрые проверки: и при разработке, и на сайте — по ссылкам со страницы родителя (ParentCheck;
 * с экранов игры ссылок нет, как и на саму страницу родителя — стережёт tests/guards.test.ts).
 * #/match?at=<warmup|half1|penalty|decisive|halftime|result> — сразу в нужное место матча; &lesson=<id> —
 * урок; &cup=<лига>&round=<0|1|2|3> — раунд кубка (0 — 1/8 … 3 — финал); &minigame=<id> — перерыв с этой мини-игрой;
 * &task=<id> — задача пенальти в at=penalty.
 * Строки «набираются» движком (typeLine), не через страницу; в сохранение ничего не пишется:
 * ни таймы, ни монеты, ни урок, ни паки, ни время игры (App.vue не считает его, как у родителя).
 * Как пользоваться — docs/testing.md, «Быстрые проверки».
 */
import type { LocationQuery } from 'vue-router';
import { keymap } from './keymap';
import { lessons } from './lessons';
import type { MatchFlow } from './matchFlow';
import { CUP_STAGES, isLeague, type CupStage, type League } from '../engine/cup';
import type { Lesson } from '../engine/lessons';
import type { LeagueRules } from '../engine/match';
import { isMinigame, type MinigameId } from '../engine/minigames';
import { startLine, typeLine } from '../engine/typing';

export const JUMPS = ['warmup', 'half1', 'penalty', 'decisive', 'halftime', 'result'] as const;
export type Jump = (typeof JUMPS)[number];

function isJump(v: unknown): v is Jump {
  return typeof v === 'string' && (JUMPS as readonly string[]).includes(v);
}

/** Проверка из адреса: что подменить в матче. */
export interface MatchPreview {
  /** Место матча; null — с начала, со вступления. */
  at: Jump | null;
  /** Звёзды итога (&stars=1|2|3); по умолчанию 2 — зачёт без третьей звезды. */
  stars: 1 | 2 | 3;
  lesson: Lesson | null;
  cup: { league: League; round: CupStage } | null;
  game: MinigameId | null;
}

/** Разбор адреса; ни одного знакомого параметра — null: обычный матч. */
export function previewOf(q: LocationQuery): MatchPreview | null {
  const game = isMinigame(q.minigame) ? q.minigame : null;
  const at = isJump(q.at) ? q.at : game ? 'halftime' : null;
  const lesson = lessons.find((l) => l.id === q.lesson) ?? null;
  const round = CUP_STAGES.find((s) => String(s) === q.round) ?? null;
  const cup = round !== null && isLeague(q.cup) ? { league: q.cup, round } : null;
  if (at === null && lesson === null && cup === null) return null;
  return { at, stars: q.stars === '1' ? 1 : q.stars === '3' ? 3 : 2, lesson, cup, game };
}

/** Что открыть: место матча, звёзды итога, урок, раунд кубка, мини-игра перерыва. */
export interface CheckTarget {
  at?: Jump;
  stars?: 1 | 2 | 3;
  lessonId?: string;
  cup?: { league: League; round: CupStage };
  game?: MinigameId;
}

/**
 * Адрес проверки для ссылки со страницы родителя (query к #/match); previewOf разбирает его
 * обратно в то же самое (tests/app.test.ts). Только знакомые параметры — без пустых.
 */
export function checkQuery(t: CheckTarget): Record<string, string> {
  const q: Record<string, string> = {};
  if (t.at) q.at = t.at;
  if (t.stars) q.stars = String(t.stars);
  if (t.lessonId) q.lesson = t.lessonId;
  if (t.cup) {
    q.cup = t.cup.league;
    q.round = String(t.cup.round);
  }
  if (t.game) q.minigame = t.game;
  return q;
}

/**
 * Ошибки по атакам: первый тайм, второй до серии, атаки решающей серии — по нужным звёздам
 * и правилам лиги урока (спека 008): ★★★ — без ошибок, ★★ — по одной (в запасе), ★ — запас+1 поровну
 * (двор — [3], район — [2, 2]).
 */
export function jumpPlan(stars: 1 | 2 | 3, rules: LeagueRules): { first: number[]; second: number[]; decisive: number[] } {
  const over = rules.maxErrors + 1;
  const decisive = Array.from({ length: rules.series }, (_, i) => {
    if (stars === 3) return 0;
    if (stars === 2) return 1;
    return Math.floor(over / rules.series) + (i < over % rules.series ? 1 : 0);
  });
  if (stars === 3) return { first: [0, 0, 1, 0, 0, 0], second: [0, 0, 0, 0, 0], decisive };
  return { first: [0, 1, 0, 3, 0, 2], second: [0, 0, 1, 0, 0], decisive };
}

/** Нажатие раз в 300 мс — темп ребёнка, чтобы итог показал правдоподобную скорость. */
const GAP_MS = 300;

/** Атака текущей строки: набрать её движком с errors ошибками и засчитать удар — тем же счётом, что в матче. */
function attack(flow: MatchFlow, errors: number): void {
  const t = (flow.typing.value.stats.lastAt ?? 0) + GAP_MS;
  const done = typeLine(keymap, flow.typing.value, errors, t, GAP_MS);
  flow.scoreAttack(done.lineErrors);
  flow.typing.value = done;
}

/** Атаки тайма с текущей строки по списку ошибок; после каждой — следующая строка, если она есть. */
function playLines(flow: MatchFlow, errors: readonly number[]): void {
  for (const n of errors) {
    attack(flow, n);
    const next = flow.lines.value[flow.lineIndex.value + 1];
    if (next === undefined) return;
    flow.lineIndex.value += 1;
    // Первая атака серии — после надписи, не подряд (как в shoot); вторая — подряд.
    flow.typing.value = startLine(next, flow.lesson.layout, flow.typing.value.stats, !flow.opensSeries.value);
  }
}

/** Переход в место матча по адресу; вызывается один раз, сразу после создания хода матча. */
export function jump(flow: MatchFlow, at: Jump, stars: 1 | 2 | 3, taskId?: string): void {
  if (at === 'warmup') return flow.begin();
  flow.startFirstHalf({});
  flow.phase.value = 'play';
  if (at === 'half1') return;
  if (at === 'penalty') {
    // Пенальти по ходу матча (спека 005): чистые атаки до места по плану матча — и слой с задачей.
    playLines(flow, Array.from({ length: flow.kickPlan.first }, () => 0));
    return flow.forcePenalty(taskId);
  }
  const p = jumpPlan(stars, flow.rules);
  playLines(flow, p.first);
  flow.endFirstHalf();
  if (at === 'halftime') return;
  flow.setupSecondHalf();
  // Все атаки до решающей серии — на начало серии (строк в тайме может быть и не шесть — берём, сколько есть).
  playLines(flow, Array.from({ length: flow.seriesStart.value }, (_, i) => p.second[i] ?? 0));
  flow.phase.value = 'play';
  if (at === 'decisive') return;
  playLines(flow, p.decisive);
  flow.finish();
}
