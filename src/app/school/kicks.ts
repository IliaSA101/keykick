/**
 * Сеанс «штрафных» (067 Т16, ТЗ-6.14, Э3.17): после остальных матчей дня — 3 задачи знакомых видов. Шаги ответа — те же, что
 * у тура (`app/school/tour.ts`): сеанс — тот же `TourRun`. «Знаток» +1 за верную с первой попытки (`finishKicks`), журнала и
 * медали нет, монет нет (Ш-З2). Зерно — по дню и номеру матча дня: перезагрузка даёт те же задачи, а оплаченный тур
 * (метка `ref` в кошельке) звено пропускает. Чистые функции: часов и случайности нет.
 */
import { isPaid, type Purse } from '../../engine/rewards/cash';
import type { Wallet } from '../../engine/rewards/section';
import { seedFromText } from '../../engine/school/answers';
import { finishKicks } from '../../engine/school/finish';
import { kicksPlan } from '../../engine/school/kicks';
import type { School } from '../../engine/school/section';
import type { Task } from '../../engine/school/tasks';
import { openRun, type TourRun } from './tour';

/** Зерно «штрафных» этого матча дня: тот же матч — те же задачи. */
export const kicksSeed = (day: string, todayN: number): number => seedFromText(`${day}:k${todayN}`) >>> 0;

/** Метка тура «штрафных» в кошельке: день и зерно; второй раз тот же тур «Знатока» не платит. */
export const kicksRef = (day: string, seed: number): string => `kicks:${day}:${seed >>> 0}`;

/** «Штрафные» этого матча уже сданы: звено пропускается (перезагрузка после итога, вторая вкладка). */
export const kicksPaid = (wallet: Wallet, day: string, todayN: number): boolean => isPaid(wallet, kicksRef(day, kicksSeed(day, todayN)));

/**
 * Входит ли ребёнок в звено: `skip` — сеанс не `ok` (записать некуда) или тур этого матча уже оплачен (Р120: после итога
 * перезагрузка не даёт те же задачи с известными ответами); иначе `play`.
 */
export const kicksEntry = (sessionOk: boolean, wallet: Wallet, day: string, todayN: number): 'skip' | 'play' => (sessionOk && !kicksPaid(wallet, day, todayN) ? 'play' : 'skip');

/** Сеанс «штрафных»; задач для них нет — `null`: цепочка пропускает звено. */
export function kicksRun(school: School, bank: readonly Task[], day: string, todayN: number, letters?: string): TourRun | null {
  const plan = kicksPlan(school, bank, school.grade, kicksSeed(day, todayN), letters);
  return plan === null ? null : openRun(plan);
}

/**
 * Итог «штрафных»: запись через `finishKicks` (касса, страж С1). Не на итоге — `null`. Возвращает кошелёк с разделом (`purse`), патч сохранения (раздел `school`
 * и кошелёк с меткой тура; экран кошелёк не пишет, он только передаёт патч) и сколько прибавлено к «Знатоку». Патч пишется всегда,
 * и при 0 верных: метка тура в кошельке — то, что не даёт перезагрузке выдать те же задачи снова (Р120).
 */
export function settleKicks(run: TourRun, purse: Purse, day: string): { purse: Purse; patch: Record<string, unknown>; knower: number } | null {
  if (run.stage !== 'result') return null;
  const out = finishKicks(purse, run.tour, { ref: kicksRef(day, run.tour.sid) });
  return { purse: out.save, patch: { school: out.save.school, wallet: out.save.wallet }, knower: out.knower };
}
