/**
 * Охрана входа (спека 019-Т11, design §3, 019-Р20): без клуба любой адрес игры ведёт на `/start`; адрес матча урока
 * «впереди» (`/match?lesson=…` на ещё не открытый урок) ведёт на карту. Чистая функция: что есть у игрока и где мы
 * (dev-сборка) приходит параметрами; роутер (`app/router.ts`) собирает их и применяет ответ.
 */
import { MAP_PATH, MATCH_PATH } from '../map/go';
import { hasAt } from '../match/showcase';

export const START_PATH = '/start';

/** Адреса, куда без клуба можно: первый запуск, страница родителя, «Кто играет?». */
const FREE_PATHS: readonly string[] = [START_PATH, '/parent', '/players'];

export interface EntryTarget {
  path: string;
  query: Readonly<Record<string, unknown>>;
  /** `meta.free` — служебные страницы dev-сборки (кадры, витрины): без выбора игрока и без клуба. */
  free: boolean;
}

export interface EntryDeps {
  /** У игрока есть клуб (`createdAt > 0`). */
  hasClub: boolean;
  dev: boolean;
  /** Урок открыт для игры (`playableNow`); неизвестный id — нет. */
  playable: (lessonId: string) => boolean;
}

const first = (v: unknown): unknown => (Array.isArray(v) ? (v as unknown[])[0] : v);

/** Витрина матча по фазе (`/match?at=win&lesson=…`): только в dev-сборке и без проверки клуба и урока; в выпуске адрес с `at` уводится на карту (019-Р33). */
export const isShowcase = (to: Pick<EntryTarget, 'path' | 'query'>, dev: boolean): boolean =>
  dev && to.path === MATCH_PATH && hasAt(to.query);

/** `true` — пускаем; иначе адрес, куда увести. */
export function entryRedirect(to: EntryTarget, d: EntryDeps): true | string {
  if (to.free || FREE_PATHS.includes(to.path) || isShowcase(to, d.dev)) return true;
  if (!d.hasClub) return START_PATH;
  // Витрина в выпуске не открывается даже на открытом уроке: страница по `at` взяла бы память, а не сохранение.
  if (to.path === MATCH_PATH && hasAt(to.query)) return MAP_PATH;
  if (to.path === MATCH_PATH) {
    const lesson = first(to.query.lesson);
    // Без урока в адресе матч не открывается: вход в матч — точка на карте.
    if (typeof lesson !== 'string' || !d.playable(lesson)) return MAP_PATH;
  }
  return true;
}
