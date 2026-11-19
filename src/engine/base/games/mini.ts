/**
 * Мини-футбол (ТЗ-7.13, 036-Р6, Э4.21–25): на футболках наших игроков — буквы выученных клавиш. Буква партнёра — пас; когда мяч у
 * нападающего (последний в составе) после хотя бы `minPasses` пасов, Пробел — удар. Матч по таймеру `matchMs`.
 * Отбор мяча соперником (067-Р52): неверная клавиша (как промах в Чеканке), мяч дольше времени удержания у игрока без паса и
 * атака соперника по своим часам каждые `foeMs`; каждый `stealsPerGoal`-й отбор — гол соперника.
 * Сила от ранга (ТЗ-7.13, К-Д): ранг клавиши игрока (`ctx.ranks`, 0…4) удлиняет время удержания мяча у него (`holdPerRankMs`)
 * и надёжность удара нападающего (`shotPerRank`); форма силы не даёт.
 * Размер команды — по номеру текущего урока (2×2 → 3×3 → 4×4). Рекорд — победы подряд: счёт итога — серия после матча
 * (победа — прежняя серия + 1, ничья и поражение — 0); серию ставят на кон при старте (`beginMini`, 067-Р50).
 * Тактика (067-Р22, выбор перед матчем): каждая меняет ОДНО на поле, числа — `base.json` `mini.tactics`. Фланг — удар увереннее (`shotBonus`);
 * Прессинг — гол соперника после каждого `stealsPerGoal`-го отбора, а не 3-го; Короткий пас — мяч держат дольше (`holdBonusMs`);
 * Контратака — после отбора мяча по времени (не по ошибке игрока) розыгрыш у нападающего, длинный пас уже засчитан (`restartAtForward`): удар сразу. Открывают тактики туры «Школы» (`tour`).
 * Без тактики (`null`) и с неизвестной — правила прежние.
 */
import cfg from '../../../content/base.json';
import { createRandom, shuffle } from '../../random';
import { seedAt, type FunInput } from './input';
import type { Base } from '../section';

const K = cfg.mini;

/** Правило тактики: что меняет (поля необязательны — тактика задаёт одно) и тур «Школы», который её открывает. */
interface Tactic {
  tour: number;
  shotBonus?: number;
  stealsPerGoal?: number;
  foeBonusMs?: number;
  restartAtForward?: boolean;
}
const TACTICS: Readonly<Record<string, Tactic>> = K.tactics;

/** Id тактик по порядку открытия (туры 4, 8, 12, 16). */
export const TACTIC_IDS: readonly string[] = Object.keys(TACTICS);

/** Тур «Школы», который открывает тактику; неизвестный id — 0. */
export const tacticTour = (id: string): number => (Object.hasOwn(TACTICS, id) ? (TACTICS[id]?.tour ?? 0) : 0);

/** Тактики, открытые к `toursDone` пройденных туров «Школы» (номер последнего тура нумерации): тур тактики ≤ пройденных. */
export const openTactics = (toursDone: number): string[] => TACTIC_IDS.filter((id) => (TACTICS[id]?.tour ?? Infinity) <= toursDone);

/** Правило выбранной тактики; нет тактики или id неизвестный — `undefined` (правила прежние). */
const ruleOf = (s: { tactic: string | null }): Tactic | undefined => (s.tactic !== null && Object.hasOwn(TACTICS, s.tactic) ? TACTICS[s.tactic] : undefined);

export interface MiniState {
  /** Буквы наших игроков (по числу игроков команды); последний — нападающий. */
  team: string[];
  /** Ранг клавиши каждого игрока (0…4), в порядке `team`. */
  power: number[];
  seed: number;
  /** Номер игрока с мячом. */
  holder: number;
  /** Пасов подряд с последнего розыгрыша. */
  passes: number;
  us: number;
  them: number;
  /** Отборов мяча соперником (считает голы соперника). */
  steals: number;
  /** Ударов по воротам (номер удара задаёт случайность удара). */
  shots: number;
  /** Старт матча и последнее действие с мячом, мс. */
  startedAt: number;
  since: number;
  /** Когда соперник атакует по своим часам, мс. */
  foeAt: number;
  /** Серия побед до этого матча. */
  streak: number;
  /** Выбранная тактика (067-Р22): id из `TACTIC_IDS` или `null` — без тактики. */
  tactic: string | null;
  over: boolean;
}

export interface MiniCtx {
  keys: string[];
  /** Номер текущего урока. */
  cur: number;
  /** Ранг клавиши (буква → 0…4); нет записи — 0. */
  ranks?: Readonly<Record<string, number>>;
  /** Серия побед до матча (её вернул `beginMini`). */
  streak?: number;
  tactic?: string | null;
}

/** Игроков в команде: по номеру текущего урока (веха `after`, как у `milestone`: `cur > after`; ТЗ-7.13, кадры Э4.25: «урок 11» — 4×4). */
export const teamSize = (cur: number): number => K.sizes.find((x) => cur > x.after)?.n ?? 2;

/** Нападающий — последний в составе. */
export const forward = (s: MiniState): number => s.team.length - 1;

/** Номер бьющего игрока: нападающий с мячом после хотя бы `minPasses` пасов; иначе `null` — бить нельзя. */
export const shooter = (s: MiniState): number | null => (s.holder === forward(s) && s.passes >= K.minPasses ? s.holder : null);

/** Игрок у ворот — Пробел бьёт. */
export const atGoal = (s: MiniState): boolean => shooter(s) !== null;

/** Время удержания мяча игроком до отбора, мс: чем выше ранг его клавиши, тем дольше. */
export const holdLimit = (s: MiniState, who: number): number => K.holdMs + K.holdPerRankMs * (s.power[who] ?? 0);

/** Надёжность удара нападающего, 0…1. */
export const shotChance = (s: MiniState): number => Math.min(1, K.shotBase + K.shotPerRank * (s.power[forward(s)] ?? 0) + (ruleOf(s)?.shotBonus ?? 0));

/** Через сколько мс атакует соперник по своим часам: у Короткого пас — реже. */
export const foeEvery = (s: MiniState): number => K.foeMs + (ruleOf(s)?.foeBonusMs ?? 0);

/** Сколько отборов подряд даёт гол соперника: у Прессинга больше. */
export const stealsToGoal = (s: MiniState): number => ruleOf(s)?.stealsPerGoal ?? K.stealsPerGoal;

export function startMini(ctx: MiniCtx, seed: number, t = 0): MiniState {
  const letters = [...new Set(ctx.keys)];
  const team = shuffle(createRandom(seed), letters).slice(0, teamSize(ctx.cur));
  const power = team.map((k) => ctx.ranks?.[k] ?? 0);
  const tactic = ctx.tactic != null && Object.hasOwn(TACTICS, ctx.tactic) ? ctx.tactic : null;
  const s: MiniState = { team, power, seed, holder: 0, passes: 0, us: 0, them: 0, steals: 0, shots: 0, startedAt: t, since: t, foeAt: t, streak: ctx.streak ?? 0, tactic, over: team.length < 2 };
  return { ...s, foeAt: t + foeEvery(s) };
}

/** Старт матча (067-Р50): серия ставится на кон — `lastN.mini = {n: 0}` без траты лимита; Esc или перезагрузка оставят 0. Возвращает прежнюю серию. */
export function beginMini(save: { base: Base }): { save: { base: Base }; streak: number } {
  const b = save.base;
  return { save: { base: { ...b, lastN: { ...b.lastN, mini: { n: 0 } } } }, streak: b.lastN.mini?.n ?? 0 };
}

/** Соперник отобрал мяч: сопернику гол через `stealsToGoal` отборов; розыгрыш с другого игрока (Контратака — у нападающего, пас уже засчитан). */
function steal(s: MiniState, t: number, byError: boolean): MiniState {
  const steals = s.steals + 1;
  const goal = steals % stealsToGoal(s) === 0;
  const fast = ruleOf(s)?.restartAtForward === true && !byError;
  return { ...s, steals, them: s.them + (goal ? 1 : 0), passes: fast ? K.minPasses : 0, holder: fast ? forward(s) : (s.holder + 1) % s.team.length, since: t };
}

/** Удар: гол, если случайность удара (по зерну и номеру удара) меньше надёжности; иначе вратарь взял — розыгрыш сначала. */
function shoot(s: MiniState, t: number): MiniState {
  const roll = createRandom(seedAt(s.seed, 1000 + s.shots))();
  const goal = roll < shotChance(s);
  const shots = s.shots + 1;
  if (!goal) return { ...s, shots, passes: 0, since: t };
  return { ...s, shots, us: s.us + 1, passes: 0, holder: seedAt(s.seed, s.us + s.them) % s.team.length, since: t };
}

/** События по часам соперника до момента `t` (по порядку): отбор за удержание и атака по `foeMs`. */
function clock(s: MiniState, t: number): MiniState {
  let cur = s;
  for (let i = 0; i < 100; i++) {
    const hold = cur.since + holdLimit(cur, cur.holder);
    const at = Math.min(hold, cur.foeAt);
    if (at >= cur.startedAt + K.matchMs || at >= t) return cur;
    cur = steal(at === cur.foeAt ? { ...cur, foeAt: cur.foeAt + foeEvery(cur) } : cur, at, false);
  }
  return cur;
}

export function stepMini(s: MiniState, input: FunInput, t: number): MiniState {
  if (s.over) return s;
  const c = clock(s, t);
  if (t - c.startedAt >= K.matchMs) return { ...c, over: true };
  if (input.kind === 'tick') return c;
  if (input.key === ' ' && atGoal(c)) return shoot(c, t);
  const to = c.team.indexOf(input.key);
  if (to < 0 || to === c.holder) return steal(c, t, true);
  return { ...c, holder: to, passes: c.passes + 1, since: t };
}

/** Итог матча: победа — наших голов больше. */
export const won = (s: MiniState): boolean => s.us > s.them;
/** Счёт для рекорда: серия побед подряд после матча. */
export const scoreMini = (s: MiniState): number => (won(s) ? s.streak + 1 : 0);
