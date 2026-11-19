/**
 * Вид Раздевалки (067 Т13, ТЗ-5.2, 5.5, 5.7; кадры Э2К.11–25, 42): какие вешалки, что собрано, что надето, что можно надеть.
 * Чистые функции от раздела `album`: ни хранилища, ни Vue. «Надеть» несобранную нельзя (К-З3, `wear`); сила игрока от формы
 * не зависит (К-З5) — раздел `album` в расчёты силы и рангов не входит, здесь формы только показываются.
 */
import { albumView } from './award';
import { PARTS } from './order';
import type { Album } from './section';
import { wear, type WearResult } from './wear';

/** `worn` — на тебе · `wearable` — собрана или получена, можно надеть · `locked` — не собрана: «Надеть» нет. */
export type HangerState = 'worn' | 'wearable' | 'locked';

export interface Hanger {
  id: string;
  /** Призовая (за событие, ТЗ-5.5), не из альбома паков. */
  prize: boolean;
  foil: boolean;
  state: HangerState;
  /** Какие части выданы (у призовой — все). */
  have: boolean[];
  /** Паков до сборки формы («ещё k урока»); у собранной и призовой — 0. */
  need: number;
}

export interface LockerView {
  /** Клубная форма надета (ничего другого не выбрано). */
  clubWorn: boolean;
  /** 13 форм альбома по порядку; несобранные — закрытые. */
  kits: Hanger[];
  /** Все призовые по порядку списка (Р136): неполученные — `locked` без частей, подпись «ещё нет». */
  prizes: Hanger[];
  /** Собрано форм из альбома. */
  full: number;
  /** Выдано частей из всех (шапка стенда Э2К.11: «17 из 39 частей»). */
  parts: number;
  total: number;
  /** С какой по счёту формы идёт фольга (Э2К.11: «формы 8–13 — с фольгой»); 0 — фольги в альбоме нет. */
  foilFrom: number;
  /** Id форм для «Рассмотреть», по порядку: собранные формы альбома. */
  viewable: string[];
}

const stateOf = (album: Album, id: string, can: boolean): HangerState => (album.worn === id ? 'worn' : can ? 'wearable' : 'locked');

export function lockerView(album: Album): LockerView {
  const v = albumView(album);
  const kits: Hanger[] = v.kits.map((k, i) => ({
    id: k.id,
    prize: false,
    foil: k.foil,
    state: stateOf(album, k.id, k.full),
    have: k.have,
    need: k.full ? 0 : (i + 1) * PARTS.length - album.packs,
  }));
  const prizes: Hanger[] = v.prize.map((p) => ({ id: p.id, prize: true, foil: false, state: stateOf(album, p.id, p.have), have: PARTS.map(() => p.have), need: 0 }));
  return { clubWorn: album.worn === null, kits, prizes, full: v.full, parts: kits.reduce((a, h) => a + h.have.filter(Boolean).length, 0), total: kits.reduce((a, h) => a + h.have.length, 0), foilFrom: kits.findIndex((h) => h.foil) + 1, viewable: v.kits.filter((k) => k.full).map((k) => k.id) };
}

/** Пара бутс Раздевалки: `basic` — светлые кеды (у всех), `yard` и `box` — купленные в Лавке (id каталога `boots-yard`, `boots-box`). */
export type BootId = 'basic' | 'yard' | 'box';
export interface BootPair {
  id: BootId;
  /** Надета: из купленных лучшая (067-Р155: выбора пары в сохранении нет, формат не меняем) — коробка, иначе дворовые, иначе кеды. */
  worn: boolean;
}

/** Пары бутс по порядку покупок (кеды → «дворовые» → «коробка»): кеды есть всегда; чужие и неизвестные id игнорируются. */
export function bootPairs(bought: readonly string[]): BootPair[] {
  const have: BootId[] = ['basic', ...(['yard', 'box'] as const).filter((id) => bought.includes(`boots-${id}`))];
  const best = have[have.length - 1];
  return have.map((id) => ({ id, worn: id === best }));
}

/** Соседняя форма в «Рассмотреть» по кругу (← →): `dir` −1 или +1; формы нет в списке — первая; список пуст — `null`. */
export function neighbour(ids: readonly string[], id: string, dir: -1 | 1): string | null {
  if (ids.length === 0) return null;
  const at = ids.indexOf(id);
  return ids[at < 0 ? 0 : (at + dir + ids.length) % ids.length] ?? null;
}

/**
 * «Надеть» в Раздевалке и в «Рассмотреть»: форма уже надета — ничего не меняется (двойной Enter не пишет второй раз, `changed: false`);
 * несобранная — отказ с причиной (`why`), запись не нужна. `null` — вернуть клубную форму.
 */
export function lockerWear(album: Album, id: string | null): WearResult & { changed: boolean } {
  const r = wear(album, id);
  return { ...r, changed: r.ok && r.album.worn !== album.worn };
}

/** С какой звезды в лиге на надетой форме появляется звёздный кант (ТЗ-4.3, 012-Р27: Двор — 10★ звезда на груди, 20★ кант). */
export const KANT_FROM = 20;

/** Кант вехи на надетой форме по числу звёзд ребёнка; у «Звёздных» кант свой (`deco` призовой), здесь — только веха. */
export function milestoneDeco(stars: number): { kant?: true } {
  return stars >= KANT_FROM ? { kant: true } : {};
}
