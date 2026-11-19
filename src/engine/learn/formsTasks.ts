/**
 * Задачи учебных игр 5–8 (067 Т5, 057 «Игры», кадры Э8.13–27): футбольное содержание — игроки, номера, позиции, формы,
 * счёт, пальцы — в видах ответа «Школы» (тот же `Task`, тот же `AnswerField`, ТЗ-7.7). Банк Школы (`tasks.json`) не берём.
 * Факты — `content/learn-forms.json`; русского текста в движке нет: `text` — ключ условия в `ru.learn.forms.ask`,
 * подстановки — `args`. Выбор и порядок — по зерну (`pick`, `shuffle`).
 */
import forms from '../../content/learn-forms.json';
import { pick, randomInt, shuffle } from '../random';
import { gcd, type AnswerInput, type MatchAnswer, type TaskAnswer } from '../school/answers';
import type { Task } from '../school/tasks';
import { findChar, isLetter, type Finger } from '../typing/keymap';
import { keymap } from '../typing/layouts';

export type FormsGame = 'squad' | 'board' | 'roster' | 'pairs';
export const FORMS_GAMES: readonly FormsGame[] = ['squad', 'board', 'roster', 'pairs'];

/** Что значат строки в вариантах ответа: `text` — показать как есть; `finger` — id пальца (имя — `ru.keyboard.fingers`); `kit` — id формы из `kits.json` (рисует экран); `player` — имя игрока (экран показывает фигуру, № и позицию из `learn-forms.json`). */
export type FormsRefs = 'text' | 'finger' | 'kit' | 'player';

/**
 * Задача игры 5–8: обычный `Task` «Школы» (нет номера в банке: `no` 0, решение пустое, не из `tasks.json`) плюс то, что движку
 * знать нельзя, а экрану нужно. `text` — ключ условия, не готовая фраза; `args` — подстановки `{имя}` в нём.
 */
export interface FormsTask extends Task {
  args: Readonly<Record<string, string>>;
  refs: FormsRefs;
  /** Начальный ввод раунда: поля уже заполнены (неверно) и их надо исправить; `null` — пустой ввод («Табло», раунд «исправить цифру»). */
  start: AnswerInput | null;
}

type Rnd = () => number;
type Player = (typeof forms.players)[number];

/** Что нужно раунду: зерно-поток, выученные буквы и игроки в порядке этой игры (раунды «Заявки» берут по одному). */
interface Build {
  game: FormsGame;
  round: number;
  rnd: Rnd;
  learned: readonly string[];
  order: readonly Player[];
}
type Builder = (b: Build) => FormsTask;

const posName = (id: string): string => forms.positions.find((p) => p.id === id)?.name ?? id;
const byPos = (id: string): Player[] => forms.players.filter((p) => p.pos === id);
const sortedNum = (xs: readonly number[]): number[] => [...xs].sort((a, b) => a - b);
const int = (rnd: Rnd, lo: number, hi: number): number => lo + randomInt(rnd, hi - lo + 1);

function make(b: Build, text: string, args: Record<string, string>, answer: TaskAnswer, refs: FormsRefs = 'text', start: AnswerInput | null = null): FormsTask {
  return { id: `forms:${b.game}:${b.round}`, no: 0, text, args, answer, refs, start, solution: '', verified: true, level: 1 };
}

/** Соединялка из пар [левое, правое]: обе колонки перемешаны, `pairs` — перестановка. */
function matchOf(rnd: Rnd, list: readonly (readonly [string, string])[]): MatchAnswer {
  const left = shuffle(rnd, list);
  const right = shuffle(rnd, list.map((p) => p[1]));
  return { kind: 'match', left: left.map((p) => p[0]), right, pairs: left.map((p) => right.indexOf(p[1])) };
}

// ---------- «Отбор в состав» ----------

/** Раунд 1, `choice`: выйти должен игрок с названным номером. */
function squadNumber(b: Build): FormsTask {
  const three = shuffle(b.rnd, forms.players).slice(0, 3);
  const correct = randomInt(b.rnd, 3);
  const answer: TaskAnswer = { kind: 'choice', options: three.map((p) => p.name), correct };
  return make(b, 'squadNumber', { num: String(three[correct]!.num) }, answer, 'player');
}

/** Раунд 2, `multi`: все с позицией или все с номером больше названного. */
function squadMulti(b: Build): FormsTask {
  if (randomInt(b.rnd, 2) === 0) {
    const pos = pick(b.rnd, forms.positions.filter((p) => byPos(p.id).length >= 2));
    const chosen = shuffle(b.rnd, [...shuffle(b.rnd, byPos(pos.id)).slice(0, 2), ...shuffle(b.rnd, forms.players.filter((p) => p.pos !== pos.id)).slice(0, 3)]);
    const correct = chosen.flatMap((p, i) => (p.pos === pos.id ? [i] : []));
    return make(b, 'squadPos', { pos: pos.acc }, { kind: 'multi', options: chosen.map((p) => p.name), correct }, 'player');
  }
  const five = shuffle(b.rnd, forms.players).slice(0, 5);
  // порог — один из четырёх меньших номеров: верных от одного до четырёх, не «все» и не «никого»
  const over = sortedNum(five.map((p) => p.num))[randomInt(b.rnd, 4)]!;
  const correct = five.flatMap((p, i) => (p.num > over ? [i] : []));
  return make(b, 'squadOver', { num: String(over) }, { kind: 'multi', options: five.map((p) => p.name), correct }, 'player');
}

/** Раунд 3, `pictures`: «формы картинками»; в `pictures` — id форм (рисует экран), верные — формы названной расцветки. */
function squadKits(b: Build): FormsTask {
  const looks = [...new Set(forms.kits.map((k) => k.look))].filter((l) => forms.kits.filter((k) => k.look === l).length >= 2);
  const look = pick(b.rnd, looks);
  const right = shuffle(b.rnd, forms.kits.filter((k) => k.look === look)).slice(0, 2);
  const other = shuffle(b.rnd, forms.kits.filter((k) => k.look !== look)).slice(0, 2);
  const kits = shuffle(b.rnd, [...right, ...other]);
  const correct = kits.flatMap((k, i) => (k.look === look ? [i] : []));
  return make(b, 'squadKit', { look }, { kind: 'pictures', pictures: kits.map((k) => k.id), correct }, 'kit');
}

// ---------- «Табло» ----------

/** Раунд 1, `fields`: счёт матча в двух полях — «Мы» и соперник. */
function boardScore(b: Build): FormsTask {
  const rival = pick(b.rnd, forms.rivals);
  const [us, them] = [int(b.rnd, 0, 5), int(b.rnd, 0, 4)];
  const fields = [{ label: forms.ours, value: us }, { label: rival, value: them }];
  return make(b, 'boardScore', { us: String(us), them: String(them), rival }, { kind: 'fields', fields, unordered: false });
}

/** Раунд 2, `expr`: минута и счёт одной строкой табло. */
function boardLine(b: Build): FormsTask {
  const [min, us, them] = [int(b.rnd, 1, 90), int(b.rnd, 0, 5), int(b.rnd, 0, 4)];
  return make(b, 'boardLine', { min: String(min), us: String(us), them: String(them) }, { kind: 'expr', parts: forms.exprParts, values: [min, us, them] });
}

/** Раунд 3, `fraction`: доля ударов в створ; дробь несократимая — запись одна. */
function boardShare(b: Build): FormsTask {
  const den = int(b.rnd, 4, 10);
  const num = pick(b.rnd, Array.from({ length: den - 1 }, (_, i) => i + 1).filter((n) => gcd(n, den) === 1));
  return make(b, 'boardShare', { den: String(den), num: String(num) }, { kind: 'fraction', num, den, mixed: false, reduced: false });
}

/** Раунд 4, `fields`: исправить цифру — гол отменили, у одной из команд на табло на один больше; поля сразу заполнены счётом табло (`start`), его правят (Backspace, 057 «Игры»). */
function boardFix(b: Build): FormsTask {
  const rival = pick(b.rnd, forms.rivals);
  const [us, them] = [int(b.rnd, 1, 5), int(b.rnd, 1, 4)];
  const ours = randomInt(b.rnd, 2) === 0;
  const fields = [{ label: forms.ours, value: ours ? us - 1 : us }, { label: rival, value: ours ? them : them - 1 }];
  const args = { us: String(us), them: String(them) };
  return make(b, ours ? 'boardFixUs' : 'boardFixThem', ours ? args : { ...args, rival }, { kind: 'fields', fields, unordered: false }, 'text', { kind: 'fields', value: [args.us, args.them] });
}

// ---------- «Заявка на матч» ----------

/** Строка заявки, `select`: игрок · позиция · номер; своего игрока в каждой строке (порядок — `order`). */
function rosterRow(b: Build): FormsTask {
  const p = b.order[b.round]!;
  const positions = forms.positions.map((x) => x.name);
  const others = shuffle(b.rnd, forms.players.filter((x) => x.num !== p.num)).slice(0, 4).map((x) => x.num);
  const nums = sortedNum([p.num, ...others]).map(String);
  const answer: TaskAnswer = { kind: 'select', row: [p.name, positions, nums], correct: [positions.indexOf(posName(p.pos)), nums.indexOf(String(p.num))] };
  return make(b, 'rosterRow', { name: p.name, pos: posName(p.pos), num: String(p.num) }, answer);
}

// ---------- «Пары» ----------

const FINGERS: readonly Finger[] = ['lp', 'lr', 'lm', 'li', 'ri', 'rm', 'rr', 'rp'];

/** Выученные буквы по пальцам: палец → его выученные буквы (карта клавиатуры, раскладка ЙЦУКЕН). */
function lettersByFinger(learned: readonly string[]): Map<Finger, string[]> {
  const out = new Map<Finger, string[]>();
  for (const ch of new Set(learned)) {
    const finger = isLetter(ch) ? findChar(keymap, 'jcuken-win', ch)?.key.finger : undefined;
    if (finger === undefined || !FINGERS.includes(finger)) continue;
    out.set(finger, [...(out.get(finger) ?? []), ch]);
  }
  return out;
}

/** Раунд 1, `match`: палец ↔ его клавиша. Пальцев — 4 или 5 из тех, на которых есть выученные буквы; в `left` — id пальцев. */
function pairsFingers(b: Build): FormsTask {
  const by = lettersByFinger(b.learned);
  const picked = shuffle(b.rnd, [...by.keys()]).slice(0, 4 + randomInt(b.rnd, 2));
  const list = picked.map((f) => [f, pick(b.rnd, by.get(f)!).toUpperCase()] as const);
  return make(b, 'pairsFinger', {}, matchOf(b.rnd, list), 'finger');
}

/** Раунд 2, `match`: игрок ↔ его позиция; по одному игроку каждой позиции. */
function pairsPositions(b: Build): FormsTask {
  const list = forms.positions.map((x) => [pick(b.rnd, byPos(x.id)).name, x.name] as const);
  return make(b, 'pairsPos', {}, matchOf(b.rnd, list), 'player');
}

/** Раунды каждой игры по порядку; виды ответа — `learn.json` `play.forms` (ловит тест). */
const BUILDERS: Record<FormsGame, readonly Builder[]> = {
  squad: [squadNumber, squadMulti, squadKits],
  board: [boardScore, boardLine, boardShare, boardFix],
  roster: [rosterRow, rosterRow, rosterRow, rosterRow, rosterRow],
  pairs: [pairsFingers, pairsPositions],
};

/** Сколько пальцев с выученными буквами нужно «Парам» (раунд 1: 4–5 пар). */
const PAIRS_MIN = 4;

/**
 * Игра собирается: у «Пар» должно быть ≥ 4 пальца с выученными буквами, у остальных — всегда (содержание своё).
 * Один предикат на очередь (`queue`) и на старт (`startForms`): очередь не предложит игру, которую нечем собрать.
 */
export function formsBuildable(game: FormsGame, learned: readonly string[]): boolean {
  return game !== 'pairs' || lettersByFinger(learned).size >= PAIRS_MIN;
}

/** Задачи всех раундов игры по зерну; вызывать только когда `formsBuildable`. */
export function buildFormsTasks(game: FormsGame, learned: readonly string[], rnd: Rnd): FormsTask[] {
  const order = shuffle(rnd, forms.players);
  return BUILDERS[game].map((build, round) => build({ game, round, rnd, learned, order }));
}
