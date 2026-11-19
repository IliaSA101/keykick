/**
 * Показ пака и призы (067 Т8, ТЗ-5.1, 067 §6). Пак выдаёт только касса (`lesson-pack` растит `album.packs`); здесь —
 * что показать на экране пака и как двигается `shown`. Перезагрузка посреди пака: `packs` уже вырос, `shown` — нет,
 * пак показывается снова. Альбом на экране — `albumView`.
 */
import { isCollected, isFoil, KIT_IDS, packAt, PARTS, PRIZE_IDS, type PackItem } from './order';
import type { Album } from './section';

/** Ближайший непоказанный пак (номер и что в нём); нет — `null`. */
export function pendingPack(album: Album): { k: number; item: PackItem } | null {
  const k = album.shown + 1;
  if (album.shown >= album.packs) return null;
  const item = packAt(k);
  return item === null ? null : { k, item };
}

/** Пак показан: `shown` растёт на 1, не выше `packs`. */
export const markShown = (album: Album): Album => (album.shown < album.packs ? { ...album, shown: album.shown + 1 } : album);

/**
 * Пак номер `k` показан: `shown` становится `k`, не выше `packs` и не ниже прежнего. Повтор (двойной Enter) и устаревший
 * номер ничего не меняют — второй показ не перескакивает через пак (067 Т12, §6 «двойной Enter»).
 */
export const markShownTo = (album: Album, k: number): Album => (Number.isInteger(k) && k > album.shown && k <= album.packs ? { ...album, shown: k } : album);

/** Призовая форма получена (повтор и неизвестный id — без изменений). */
export const grantPrize = (album: Album, id: string): Album => (PRIZE_IDS.includes(id) && !album.prize.includes(id) ? { ...album, prize: [...album.prize, id] } : album);

export interface KitView {
  id: string;
  /** Какие из частей (футболка, шорты, гетры) выданы. */
  have: boolean[];
  full: boolean;
  /** Вторая половина альбома: фольга на канте и номере (ТЗ-5.4). */
  foil: boolean;
  worn: boolean;
}

export interface AlbumView {
  kits: KitView[];
  prize: Array<{ id: string; have: boolean; worn: boolean }>;
  /** Собранных форм. */
  full: number;
}

/** Альбом Двора: 13 форм с частями и фольгой, призовые отдельным рядом (049-Р6). Считает по `album.packs`. */
export function albumView(album: Album): AlbumView {
  const kits = KIT_IDS.map((id, i) => ({
    id,
    have: PARTS.map((_, p) => album.packs >= i * PARTS.length + p + 1),
    full: isCollected(album.packs, id),
    foil: isFoil(id),
    worn: album.worn === id,
  }));
  return { kits, prize: PRIZE_IDS.map((id) => ({ id, have: album.prize.includes(id), worn: album.worn === id })), full: kits.filter((k) => k.full).length };
}

/** Выдача нескольких призовых за событие (Кубок, ТЗ-8.7): новые id по порядку; уже полученные и неизвестные не выдаются повторно. */
export function grantPrizes(album: Album, ids: readonly string[]): { album: Album; fresh: string[] } {
  let a = album;
  const fresh: string[] = [];
  for (const id of ids) {
    const next = grantPrize(a, id);
    if (next !== a) fresh.push(id);
    a = next;
  }
  return { album: a, fresh };
}
