/**
 * Что показывает экран матча (065 Т9б): табло, строка набора, статус — чистая функция от состояния матча, без Vue и DOM.
 * Экран ничего не считает сам: «Атака 4 из 4», запас ошибок, цель и палец берутся отсюда (тест `tests/match/run.test.ts`).
 * Тексты («1-й тайм», «Атака») — из `ru.match`, сюда приходят уже готовые слова.
 */
import { expectedHit, expectedThumb } from '../../engine/typing/typing';
import { findChar, type Keymap, type Layout, type Thumb } from '../../engine/typing/keymap';
import { totalOf, type RunningMatch } from '../../engine/match';
import type { FrameShow } from '../../app/match/frame';
import { ru } from '../../i18n/ru';
import { plural } from '../../i18n/plural';

export interface MatchView {
  /** Табло слева: фаза («1-й тайм»). */
  phase: string;
  /** Табло справа: подробность («Атака 4 из 4»); пусто — ничего. */
  detail: string;
  score: { me: number; opp: number };
  /** Строка «Строка N из M» атаки; `null` — строки нет (перерыв, итог). */
  line: { n: number; of: number } | null;
  /** Запас ошибок: по шарику на каждую ошибку до гола соперника, `true` — шарик погашен. */
  balls: boolean[];
  /** Код клавиши-цели (`KeyboardEvent.code`) и половина пробела, если цель — пробел. */
  target: { code: string; thumb: Thumb | null; finger: string } | null;
  /** Знаки строки: напечатано, текущая, следующие строки атаки. */
  typed: { text: string; pos: number } | null;
  next: string[];
}

/** Коды клавиш новых букв урока — на клавиатуре вступления они светятся (Э1.01: В и Л). */
export const litCodes = (newKeys: string, keymap: Keymap, layout: Layout): string[] =>
  [...newKeys].flatMap((ch) => findChar(keymap, layout, ch)?.key.code ?? []);

/** «1 атака», «4 атаки», «5 атак» — число атак тайма во вступлении. */
export const attacksText = (n: number): string => `${n} ${plural(n, ru.match.intro.attacks)}`;

const phaseName = (p: RunningMatch['phase']): string => {
  const m = ru.match.phase;
  if (p === 'half1') return m.half1;
  if (p === 'half2' || p === 'penalty') return m.half2; // пенальти — во 2-м тайме: слева «2-й тайм», «Пенальти» справа (Э1.18)
  if (p === 'warmup') return m.warmup;
  if (p === 'break') return m.break;
  if (p === 'extra') return m.extra;
  return m.result;
};

/** Название пальца цели для строки «Бей пальцем» (пробел — большой нужной руки). */
function fingerName(finger: string, thumb: Thumb | null): string {
  const f = ru.match.status.fingers;
  if (finger === 'th') return thumb === 'left' ? f.thl : f.thr;
  return f[finger as keyof typeof f];
}

export function viewOf(s: RunningMatch): MatchView {
  const attack = s.plan[s.at];
  const inPhase = attack === undefined ? 0 : s.plan.filter((a) => a.phase === attack.phase).length;
  const d = ru.match.detail;
  const playing = s.typing !== null && attack !== undefined;
  let detail = '';
  if (s.phase === 'warmup') detail = d.warmupNoScore;
  else if (s.phase === 'extra') detail = d.extraOne;
  else if (s.phase === 'penalty') detail = ru.match.phase.penalty;
  else if ((s.phase === 'half1' || s.phase === 'half2') && attack !== undefined) detail = `${d.attack} ${attack.index + 1} ${d.of} ${inPhase}`;
  const errors = s.attackErrors + (s.typing?.lineErrors ?? 0);
  const hit = s.typing === null ? null : expectedHit(s.keymap, s.typing);
  const thumb = s.typing === null ? null : expectedThumb(s.keymap, s.typing);
  return {
    phase: phaseName(s.phase),
    detail,
    score: totalOf(s), // на табло — с голом пенальти (ТЗ-2.6: в звёзды он не идёт, это решает итог)
    line: playing ? { n: s.row + 1, of: attack.rows.length } : null,
    balls: Array.from({ length: s.rules.concedeMin }, (_, i) => i < errors),
    target: hit === null ? null : { code: hit.key.code, thumb, finger: fingerName(hit.key.finger, thumb) },
    typed: s.typing === null ? null : { text: s.typing.text, pos: s.typing.pos },
    next: playing ? attack.rows.slice(s.row + 1) : [],
  };
}

/** Кадр стенда (065-Р96): подставляет строки, цель и номер строки из кадра; без `show` — вид как есть. Неизвестная клавиша — ошибка. */
export function withShow(v: MatchView, show: FrameShow | undefined, keymap: Keymap): MatchView {
  if (show === undefined) return v;
  const out: MatchView = { ...v };
  if (show.text !== undefined) out.typed = { text: show.text, pos: show.pos ?? 0 };
  if (show.next !== undefined) out.next = show.next;
  if (show.row !== undefined) out.line = show.row;
  if (show.target !== undefined) {
    const key = keymap.byCode.get(show.target);
    if (key === undefined) throw new Error(`withShow: unknown key ${show.target}`);
    const thumb = key.finger === 'th' ? (show.thumb ?? 'right') : null;
    out.target = { code: key.code, thumb, finger: fingerName(key.finger, thumb) };
  }
  return out;
}
