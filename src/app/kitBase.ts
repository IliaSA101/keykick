// Слои основы комплекта: грузятся один раз на всё приложение, дальше каждый предмет — только перекраска.
// Ключ — «крой × вид» (спека 004, design.md §5): новые крои лягут рядом, не переделывая ключ.
import { artUrl, type ArtKey } from '../art/assets';
import { bodyBox, opaqueBox, type BodyBox, type KitLayers, type OpaqueBox } from '../engine/kit';

export type Cut = 'classic';
/** Футболка спереди и сзади, шорты, гетры, бутсы. */
export type View = 'front' | 'back' | 'shorts' | 'socks' | 'boots';
type BaseKey = `${Cut}:${View}`;

export interface KitBase {
  layers: KitLayers;
  /** Рамка корпуса для узора — только у футболки (front, back). */
  box: BodyBox | null;
  /** Где на холсте сам предмет: по ней предмет обрезается и раскладывается в комплекте. */
  frame: OpaqueBox | null;
}

const files: Record<BaseKey, readonly [ArtKey, ArtKey]> = {
  'classic:front': ['kitZones', 'kitShade'],
  'classic:back': ['kitBackZones', 'kitBackShade'],
  'classic:shorts': ['shortsZones', 'shortsShade'],
  'classic:socks': ['socksZones', 'socksShade'],
  'classic:boots': ['bootsZones', 'bootsShade'],
};

const pending: Partial<Record<BaseKey, Promise<KitBase>>> = {};
/** Уже загруженные основы: по ним размер холста известен сразу, без скачка вёрстки. */
const ready: Partial<Record<BaseKey, KitBase>> = {};

const isShirt = (view: View): boolean => view === 'front' || view === 'back';

/** Пиксели картинки как есть: без пересчёта цветового профиля и без умножения на альфу. */
async function pixels(url: string): Promise<ImageData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`kit layer ${url}: ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob(), {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('2d context is not available');
  g.drawImage(bitmap, 0, 0);
  bitmap.close();
  return g.getImageData(0, 0, canvas.width, canvas.height);
}

export function loadKitBase(view: View = 'front', cut: Cut = 'classic'): Promise<KitBase> {
  const key: BaseKey = `${cut}:${view}`;
  const [zonesKey, shadeKey] = files[key];
  pending[key] ??= Promise.all([pixels(artUrl(zonesKey)), pixels(artUrl(shadeKey))])
    .then(([zones, shade]) => {
      const layers: KitLayers = { width: zones.width, height: zones.height, zones: zones.data, shade: shade.data };
      const base: KitBase = {
        layers,
        box: isShirt(view) ? bodyBox(layers, view === 'back') : null,
        frame: opaqueBox(layers),
      };
      ready[key] = base;
      return base;
    })
    .catch((err: unknown) => {
      // Сбой сети не должен навсегда оставить шкафчик пустым: следующий показ попробует снова.
      delete pending[key];
      throw err;
    });
  return pending[key];
}

/** Основа, если уже загружена; иначе null (тогда размер холста станет известен после загрузки). */
export function loadedKitBase(view: View, cut: Cut = 'classic'): KitBase | null {
  return ready[`${cut}:${view}`] ?? null;
}

/**
 * Шорты, гетры и бутсы — заранее (пак грузит их, пока трясётся): иначе комплект в первый
 * раз появился бы футболкой и раздался вширь после загрузки.
 */
export function loadOutfitBases(cut: Cut = 'classic'): Promise<KitBase[]> {
  return Promise.all([loadKitBase('shorts', cut), loadKitBase('socks', cut), loadKitBase('boots', cut)]);
}
