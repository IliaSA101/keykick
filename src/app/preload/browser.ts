/**
 * Подключение догрузки к браузеру (067 Т23): окружение очереди и вход «ребёнок перешёл на экран». Загрузка — `new Image()` с
 * `fetchPriority = 'low'`, а не `fetch(url, {priority})`: сеть вне `app/packs|sound|access` стережёт страж (060 §8), а картинка
 * ложится в тот же HTTP-кэш, из которого экран потом берёт её через `<img>` и CSS. Простой — `requestIdleCallback`, запасной — `setTimeout`.
 */
import { currentLesson } from '../home/input';
import { lessonOrder } from '../packs/usePack';
import { useSession } from '../save/session';
import type { CourseProgress } from '../../engine/course/reconcile';
import type { Shop } from '../../engine/shop/section';
import { planOf, type ArtCtx } from './art';
import { screenOfRoute } from './graph';
import { createPreloader, type PreloadEnv } from './queue';

type Conn = { saveData?: boolean; effectiveType?: string };

/** Слабая сеть: экономия трафика или 2g — фоновой догрузки нет. */
export const isWeak = (c: Conn | undefined): boolean => c?.saveData === true || c?.effectiveType === 'slow-2g' || c?.effectiveType === '2g';

const base = import.meta.env.BASE_URL;
/** Картинки, пока грузятся, держатся здесь: сборщик мусора не обрывает запрос. */
const loading = new Set<HTMLImageElement>();

const env: PreloadEnv = {
  load: (url) =>
    new Promise((resolve) => {
      const img = new globalThis.Image();
      loading.add(img);
      const done = (): void => {
        loading.delete(img);
        resolve();
      };
      img.onload = done;
      img.onerror = done;
      img.fetchPriority = 'low';
      img.src = `${base}${url}`;
    }),
  idle: (run) => (typeof globalThis.requestIdleCallback === 'function' ? void globalThis.requestIdleCallback(() => run(), { timeout: 4000 }) : void globalThis.setTimeout(run, 200)),
  weak: () => isWeak((globalThis.navigator as Navigator & { connection?: Conn }).connection),
};

const preloader = createPreloader(env);
let order: Promise<string[]> | null = null;

/** Состояние для списков графики: урок Дома по порядку пакета и купленное; нет игрока или пакета — `cur: null`. */
async function ctxNow(): Promise<ArtCtx> {
  const p = useSession().player.value;
  if (p.kind !== 'ok') return { cur: null, bought: [] };
  const course = p.env.sections['course:ru']?.data as CourseProgress | undefined;
  const shop = p.env.sections.shop?.data as Shop | undefined;
  order ??= lessonOrder().then((ids) => {
    if (ids.length === 0) order = null; // пустой порядок (пакет не открылся) не запоминаем: в следующий раз спросим заново
    return ids;
  });
  const ids = await order;
  return { cur: course && ids.length > 0 ? currentLesson(course, ids) : null, bought: shop?.bought ?? [] };
}

/** Роутер сообщает: ребёнок на экране `name`. Стенд кадров (`/dev/*`) и слабая сеть — молчим. */
export async function onRoute(name: string, params: { game?: unknown }, path: string): Promise<void> {
  const screen = path.startsWith('/dev/') ? null : screenOfRoute(name, params);
  if (screen === null || env.weak()) return;
  preloader.enter(planOf(screen, await ctxNow()));
}
