/**
 * Цепочка после итога матча (067 Т12, К-Б, ТЗ-10.11): ведёт по звеньям `afterResult` — пак → праздник → «Тур ждёт» или «штрафные».
 * Чистые функции: звенья считает движок (`engine/day/chain.ts`) от сохранения, здесь — какое звено следующее и куда ведёт.
 * Звено не теряется: пак живёт в `album.shown` (пока «Дальше» не нажато, пак показывается снова), остальные считаются заново от
 * сохранения; Esc на звене — Дом без записи, следующий заход начинает с того же звена. «Тур ждёт» — пока тур дня не взят (Р73).
 * Звено без готового экрана цепочка пропускает (`READY_STEPS`, 067-Р70): ребёнок не попадает на заглушку «строится», цель не теряется.
 * Цель цепочки — обычная переменная модуля: не реактивна, живёт до перезагрузки вкладки (после неё цель — Дом).
 */
import type { Album } from '../../engine/album/section';
import { afterResult, type ChainSave, type Step } from '../../engine/day/chain';
import type { Day } from '../../engine/day/section';
import { systemOpen, type HomeInput } from '../../engine/home';
import type { School } from '../../engine/school/section';
import { tourWaits } from '../school/journal';
import type { ResultGo } from './card';

/** Адрес звена. Праздник — поставщик волны 5 (пока пуст, звено не появляется), адрес — запасной. */
export const STEP_PATH: Record<Step, string> = { pack: '/pack', celebrate: '/home', tourWaits: '/school/waits', kicks: '/school/kicks' };
const ORDER: readonly Step[] = ['pack', 'celebrate', 'tourWaits', 'kicks'];
/** Звенья с готовым экраном (067-Р70): остальные цепочка пропускает. Волна 5 добавит `celebrate`. */
export const READY_STEPS: readonly Step[] = ['pack', 'tourWaits', 'kicks'];
/** Куда ведёт цепочка, когда звенья кончились. */
export const GO_PATH: Record<ResultGo, string> = { map: '/map', home: '/home', replay: '/match' };

/** Следующее звено после `after` (`null` — с начала): первое из `steps` позже него по порядку цепочки. */
export function nextStep(steps: readonly Step[], after: Step | null): Step | null {
  const from = after === null ? -1 : ORDER.indexOf(after);
  return ORDER.find((s, i) => i > from && steps.includes(s)) ?? null;
}

/** Сохранение для цепочки из разделов: пак, день и «тур дня не взят» (Р73, `done` — взятые тренажёры, Р203) — один источник для итога матча и пака. */
export const chainSave = (album: Album, day: Day, school: School, today: string, done: readonly string[]): ChainSave => ({ album, day, tourWaits: tourWaits(school, day, today, done) });

/** Школа открыта для звена «Тур ждёт»/«штрафные» (замок ТЗ-1.9): Дом ещё не собран — закрыта. */
export const schoolOpenOf = (input: HomeInput | null): boolean => input !== null && systemOpen('school', input);

/**
 * Куда идти после звена `after` (`null` — с итога): адрес следующего звена или `null` — звенья кончились.
 * Звенья считаются от сохранения каждый раз заново: пак, нажатый «Дальше», уже не в списке; звенья без готового экрана пропускаются.
 */
export function chainNext(save: ChainSave, schoolOpen: boolean, after: Step | null, now: number, ready: readonly Step[] = READY_STEPS): { step: Step; path: string } | null {
  const step = nextStep(afterResult(save, { schoolOpen }, now).filter((s) => ready.includes(s)), after);
  return step === null ? null : { step, path: STEP_PATH[step] };
}

/** Куда вернуться, когда звенья кончатся: Карта или Дом; перезагрузка посреди — Дом. */
let target: ResultGo = 'home';
export const setChainTarget = (go: ResultGo): void => void (target = go);
/** Конец цепочки: адрес цели; цель сбрасывается — следующая цепочка начнёт с итога. */
export function endChain(): string {
  const path = GO_PATH[target];
  target = 'home';
  return path;
}
/** Esc на звене: Дом, цель забыта; сохранение не тронуто — звено вернётся в следующий заход. */
export function escChain(): string {
  dropChain();
  return GO_PATH.home;
}
/** Цепочка кончилась не на цели (ребёнок ушёл в тур): цель забыта, итог тура ведёт в журнал (Р79). */
export function dropChain(): void {
  target = 'home';
}
