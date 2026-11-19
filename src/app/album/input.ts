/**
 * Вход экрана пака (067 Т12, ТЗ-5.1–5.3, 10.11; кадры Э2К.05–10, 43): что лежит в ближайшем непоказанном паке и как пак закрывается.
 * Чистые функции от раздела `album`: ни хранилища, ни часов, ни Vue. Порядок паков — `packAt` (067-Р9: форма каждые 3 пака, шансов нет);
 * перезагрузка посреди пака — `shown` не двигался, пак показывается снова (067 §6).
 */
import { markShownTo, pendingPack } from '../../engine/album/award';
import { kitOf, type AlbumKit } from '../../engine/album/kit';
import { isCollected, isFoil, KIT_IDS, PACKS_YARD, PARTS, type Part } from '../../engine/album/order';
import type { Album } from '../../engine/album/section';
import { wear } from '../../engine/album/wear';

/** `new` — первая часть новой формы, `part` — вторая, `full` — третья (форма собрана), `foil` — первая форма с фольгой (ТЗ-5.4). */
export type PackKind = 'new' | 'part' | 'full' | 'foil';

export interface PackView {
  /** Номер пака (1…39). */
  k: number;
  kit: AlbumKit;
  /** Форма из второй половины альбома — с фольгой. */
  foil: boolean;
  part: Part;
  /** Какие из трёх частей формы выданы к этому паку. */
  have: boolean[];
  /** Сколько частей формы выдано (1…3). */
  n: number;
  /** Каких частей ещё нет. */
  left: Part[];
  kind: PackKind;
  /** Всего частей альбома выдано к этому паку и собрано форм (подпись внизу окна). */
  total: { parts: number; of: number; full: number; forms: number };
}

/** Ближайший непоказанный пак для экрана; нет пака (всё показано, альбом собран, форма не из `kits.json`) — `null`. */
export function packView(album: Album): PackView | null {
  const p = pendingPack(album);
  if (p === null) return null;
  const kit = kitOf(p.item.kit);
  if (kit === null) return null;
  const at = KIT_IDS.indexOf(p.item.kit);
  const idx = PARTS.indexOf(p.item.part);
  const have = PARTS.map((_, i) => i <= idx);
  const n = idx + 1;
  const foil = isFoil(kit.id);
  const first = foil && !isFoil(KIT_IDS[at - 1] ?? '');
  const kind: PackKind = n === PARTS.length ? 'full' : first && n === 1 ? 'foil' : n === 1 ? 'new' : 'part';
  return {
    k: p.k,
    kit,
    foil,
    part: p.item.part,
    have,
    n,
    left: PARTS.filter((_, i) => !have[i]),
    kind,
    total: { parts: p.k, of: PACKS_YARD, full: KIT_IDS.filter((id) => isCollected(p.k, id)).length, forms: KIT_IDS.length },
  };
}

/**
 * Закрыть пак `v`: показан (`shown`) и, если ребёнок нажал «Надеть», форма надета (только собранная — ТЗ-5.2). Повтор того же пака
 * (двойной Enter) ничего не меняет: `shown` уже догнал номер (`markShownTo`).
 */
export function closePack(album: Album, v: Pick<PackView, 'k' | 'kit' | 'kind'>, wearIt: boolean): Album {
  const shown = markShownTo(album, v.k);
  if (!wearIt) return shown;
  const w = wear(shown, v.kit.id);
  return w.ok ? w.album : shown;
}

/** Фаза экрана пака: закрытый · разрыв (пак дрожит) · форма показана. */
export type PackPhase = 'closed' | 'opening' | 'shown';

/** Что сделать на выходе: отметить пак показанным, надеть ли форму, куда — дальше по цепочке или Дом. */
export interface PackExit {
  mark: boolean;
  wear: boolean;
  go: 'chain' | 'home';
}

const HOME: PackExit = { mark: false, wear: false, go: 'home' };

/**
 * Решение «что делать» на Enter и кнопках «Дальше», «Надеть» (`enter`) и на Esc и кнопке «Позже» (`esc`): одно место для экрана и теста (067 §6).
 * Enter: форма показана — пак показан, собранная форма надета, дальше цепочка; пак закрыт или рвётся — `null`, решает сам экран (открыть).
 * Esc: на закрытом паке — Дом без записи (пак вернётся); на открытом — пак показан, форма не надета; «Форма собрана» (там Esc — «Позже»)
 * цепочку продолжает, остальные виды — Дом. Вторая вкладка (`editable: false`): записи нет, «Надеть» и «Позже» молчат, остальное — Дом.
 */
export function packExit(phase: PackPhase, kind: PackKind | null, how: 'enter' | 'esc', editable = true): PackExit | null {
  if (how === 'enter') {
    if (phase !== 'shown') return null;
    if (!editable) return kind === 'full' ? null : HOME;
    return { mark: true, wear: kind === 'full', go: 'chain' };
  }
  if (!editable || phase !== 'shown') return HOME;
  return { mark: true, wear: false, go: kind === 'full' ? 'chain' : 'home' };
}
