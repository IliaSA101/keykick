/**
 * Итог игры на интерес (ТЗ-7.10): рекорд, счётчик дня, метка «видел». Монет нет (ТЗ-0.3) — кассу не зовём, раздел `wallet`
 * не меняется. Игра считается только доигранной; брошенная (Esc) лимит не тратит. Лимит исчерпан, игра неизвестна или повтор того же `run` —
 * сохранение без изменений (`view: null` для повтора, `'closed'` — лимит и неизвестная игра). Пустой `run` защиты от повтора не даёт.
 */
import { FUN_IDS, FUN_PER_DAY } from './open';
import { judge, type RecordKind } from './records';
import type { Base, FunRecord, LastScore } from './section';

export interface FunResult {
  id: string;
  score: number;
  /** Идентификатор прогона: повтор с тем же `run` ничего не меняет (как `matchId` у матча). */
  run: string;
  /** Время Штрафного, с. */
  t?: number;
}

export interface FunFinish {
  save: { base: Base };
  /** `closed` — лимит дня исчерпан или игра неизвестна; `null` — повтор того же `run` или неверное время: ничего не записано. */
  view: { score: number; record: RecordKind; coins: 0 } | 'closed' | null;
}

export function finishFun(save: { base: Base }, result: FunResult, ctx: { day: string }): FunFinish {
  const b = save.base;
  if (result.run !== '' && b.last?.run === result.run) return { save, view: null };
  if (result.t !== undefined && !(Number.isFinite(result.t) && result.t >= 0)) return { save, view: null };
  const today = b.day === ctx.day ? b.today : 0;
  if (!FUN_IDS.includes(result.id) || today >= FUN_PER_DAY) return { save, view: 'closed' };
  const t = result.t === undefined ? undefined : Math.round(result.t);
  const record = judge(result.id, result.score, b.records[result.id]?.n, t, b.records[result.id]?.t);
  const rec: FunRecord = { n: result.score, day: ctx.day };
  const lastScore: LastScore = { n: result.score };
  if (t !== undefined) {
    rec.t = t;
    lastScore.t = t;
  }
  const records = record === 'same' ? b.records : { ...b.records, [result.id]: rec };
  const played = b.day === ctx.day ? b.played : [];
  const seen = b.seen.includes(result.id) ? b.seen : [...b.seen, result.id];
  return { save: { base: { day: ctx.day, today: today + 1, records, played: played.includes(result.id) ? played : [...played, result.id], lastN: { ...b.lastN, [result.id]: lastScore }, last: result.run === '' ? null : { run: result.run, id: result.id }, seen } }, view: { score: result.score, record, coins: 0 } };
}

/** Метка «видел» без игры (открыл экран игры). */
export function markSeen(base: Base, id: string): Base {
  return FUN_IDS.includes(id) && !base.seen.includes(id) ? { ...base, seen: [...base.seen, id] } : base;
}
