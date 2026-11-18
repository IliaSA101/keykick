/**
 * Перекрашенные спрайты людей (065 Т7в, Р80): картинка → canvas → байты → `recolorCrowd` (движок) → адрес картинки в памяти.
 * Одно перекрашивание на пару «файл, оттенок»; без печи и новых файлов в `public/art`.
 */
import { recolorCrowd } from '../../engine/club/crowd';

const cache = new Map<string, Promise<string>>();

/** Адрес перекрашенного спрайта; не вышло (нет canvas, картинка не загрузилась) — исходный адрес. */
export function tintedSprite(src: string, hue: number): Promise<string> {
  const key = `${hue}|${src}`;
  let p = cache.get(key);
  if (!p) {
    p = new Promise<string>((done) => {
      const img = new Image();
      img.onload = (): void => {
        const cv = document.createElement('canvas');
        cv.width = img.naturalWidth;
        cv.height = img.naturalHeight;
        const cx = cv.getContext('2d');
        if (!cx) return done(src);
        cx.drawImage(img, 0, 0);
        const px = cx.getImageData(0, 0, cv.width, cv.height);
        recolorCrowd(px.data, hue);
        cx.putImageData(px, 0, 0);
        done(cv.toDataURL('image/png'));
      };
      img.onerror = (): void => done(src);
      img.src = src;
    });
    cache.set(key, p);
  }
  return p;
}
