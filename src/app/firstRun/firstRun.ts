/**
 * Первый запуск (спека 019, design §3, Р1–Р3): шаги, черновик в памяти и проверка перед «Готово».
 * До «Готово» в хранилище не пишется ничего (Р2): черновик живёт здесь, F5 его сбрасывает.
 * Экран — `screens/firstRun/FirstRunScreen.vue` (Т6): шаги, проверка и «Готово» считаются здесь, экран только показывает.
 * Охрана остальных адресов без клуба — `firstRun/entry.ts` (Т11).
 */
import { reactive } from 'vue';
import { checkClubName, type ClubNameError } from '../../engine/club/names';
import { checkCity, DEFAULT_KIT, hasClub, suggestClubName, type CityError, type ClubDraft, type ClubFields } from '../../engine/club/create';
import { clubData } from '../kits';
import { clubRef, createClubNow } from '../club/club';
import { MAP_PATH } from '../map/go';

/** Экраны до карты: карточка, клуб, город. */
export const FIRST_RUN_STEPS = ['card', 'club', 'city'] as const;
export type FirstRunStep = (typeof FIRST_RUN_STEPS)[number];

/**
 * Дополнительные экраны первого запуска — место под комикс-завязку 039. В 019 пусто.
 * Тест «≤ 6 экранов» (В8): шаги + дополнительные + карта + вступление матча.
 */
export const FIRST_RUN_EXTRA: readonly string[] = [];

/** Клуб нужен, пока он не создан (`createdAt = 0`). */
export const needsClub = (club: Pick<ClubFields, 'createdAt'>): boolean => !hasClub(club);

const FIRST_KIT = (): ClubDraft['kit'] => clubData.palettes[0] ?? DEFAULT_KIT;

/** Черновик клуба: форма по умолчанию — первая палитра, поля пусты. Реактивный, в память страницы. */
export const firstRunDraft: ClubDraft = reactive({ name: '', kit: FIRST_KIT(), city: '' });

/**
 * Сбросить черновик на входе в `/start`: первая палитра, город пуст, название — готовый вариант из слов клуба
 * (ребёнку не надо думать с пустого поля; «Придумать» даст другое). Зерно приходит снаружи — часы страницы.
 * `from` — образец для быстрой проверки (`#/start?at=…`): им заполняется всё как есть.
 */
export function resetDraft(seed: number, from?: ClubDraft): void {
  const d = from ?? { name: suggestClubName(clubData, '', seed), kit: FIRST_KIT(), city: '' };
  firstRunDraft.name = d.name;
  firstRunDraft.kit = d.kit;
  firstRunDraft.city = d.city;
}

export type DraftCheck =
  | { ok: true; draft: ClubDraft }
  | { ok: false; field: 'name'; error: ClubNameError }
  | { ok: false; field: 'city'; error: CityError };

/** Проверка и приведение черновика (обрезка, заглавная в городе) перед записью. */
export function checkDraft(d: ClubDraft): DraftCheck {
  const name = checkClubName(d.name);
  if (!name.ok) return { ok: false, field: 'name', error: name.error };
  const city = checkCity(d.city);
  if (!city.ok) return { ok: false, field: 'city', error: city.error };
  return { ok: true, draft: { name: name.name, kit: d.kit, city: city.city } };
}

/** Куда уходит первый запуск, когда клуб есть: на карту Двора (019-Р20, Т7). */
export const AFTER_START = MAP_PATH;

/** Шаг после текущего; `null` — это последний шаг, дальше «Готово». */
export function stepAfter(step: FirstRunStep): FirstRunStep | null {
  return FIRST_RUN_STEPS[FIRST_RUN_STEPS.indexOf(step) + 1] ?? null;
}

/** Шаг назад; `null` — на первом шаге назад некуда (Esc ничего не делает). */
export function stepBefore(step: FirstRunStep): FirstRunStep | null {
  return FIRST_RUN_STEPS[FIRST_RUN_STEPS.indexOf(step) - 1] ?? null;
}

/**
 * Быстрая проверка `#/start?at=card|club|city` — только в dev-сборке (design §3, В5). Без `at` или в выпуске — всегда
 * первая карточка. Второе значение — «это образец»: охрана и «клуб появился» его не трогают, ничего не пишется.
 */
export function startAt(query: unknown, dev: boolean): { step: FirstRunStep; sample: boolean } {
  const at = dev ? (query as { at?: unknown } | null)?.at : undefined;
  const step = FIRST_RUN_STEPS.find((s) => s === at);
  return step === undefined ? { step: 'card', sample: false } : { step, sample: true };
}

/** Охрана `/start`: клуб уже есть (в том числе из другой вкладки) — сразу дальше; образец dev-сборки проходит. */
export function startGuard(to: { query: unknown }, dev: boolean = import.meta.env.DEV): true | typeof AFTER_START {
  if (startAt(to.query, dev).sample) return true;
  return hasClub(clubRef.value) ? AFTER_START : true;
}

/** Что делать экрану после «Готово». */
export type FinishResult =
  | { to: 'next' }
  | { to: 'step'; step: FirstRunStep }
  | { to: 'blocked' };

/**
 * «Готово»: проверка черновика и одна запись клуба. Клуб лежит (создан тут или другой вкладкой) — `next`;
 * ошибка названия — шаг клуба, ошибка города — остаёмся; записать нельзя (только чтение, игрока нет) — `blocked`:
 * экран не возвращает на `/start` по кругу (019-Р19).
 */
export function finishFirstRun(
  d: ClubDraft,
  o: { now: number; player?: string | null },
  create: typeof createClubNow = createClubNow,
): FinishResult {
  const check = checkDraft(d);
  if (!check.ok) return { to: 'step', step: check.field === 'name' ? 'club' : 'city' };
  const res = create(check.draft, o.player === undefined || o.player === null ? { now: o.now } : { now: o.now, player: o.player });
  return res.blocked ? { to: 'blocked' } : { to: 'next' };
}
