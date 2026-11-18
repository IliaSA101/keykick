/**
 * «Что нового» (010-Р4, 063 Т11): сравнение версий и отбор строк карточки. Чистые функции: номер версии игры приходит
 * аргументом, ничего глобального здесь нет. Раздел игрока `seen.news` — версия, до которой игрок видел новости.
 */
import type { Seen } from '../seen/section';
import { VERSION_RE, isVersion } from './version';

/** Запись о версии: что увидит ребёнок (kid) и что прочтёт родитель (parent). Пустой kid — карточки нет. */
export interface NewsEntry {
  version: string;
  /** «ГГГГ-ММ-ДД»; пусто — дата ещё не поставлена (до выпуска). */
  date: string;
  kid: string[];
  parent: string[];
}

/** Карточка — только с этой версии: записи 0.x остались от первой версии игры, её хранилище с этой не пересекается (059-В2). */
export const NEWS_FROM = '2.0.0';
/** Больше строк в карточке ребёнка не бывает: пропустившему много версий — только свежее. */
export const NEWS_KID_MAX = 6;

function parts(v: string): [number, number, number] {
  const m = VERSION_RE.exec(v);
  return m === null ? [0, 0, 0] : [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** По числам, а не по строкам: 2.10.0 > 2.9.0. Битый номер — 0.0.0. */
export function compareVersions(a: string, b: string): number {
  const x = parts(a);
  const y = parts(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/** Записи с версией от `NEWS_FROM` до `current`, новые сверху; с битым номером — выбрасываются. */
function shown(news: readonly NewsEntry[], current: string): NewsEntry[] {
  return news
    .filter((n) => isVersion(n.version) && compareVersions(n.version, NEWS_FROM) >= 0 && compareVersions(n.version, current) <= 0)
    .sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * Строки карточки игрока: kid версий, что новее `seen` и не новее `current`, новые сверху, не больше `NEWS_KID_MAX`.
 * Новичку `seen` = текущая версия (его раздел создан сейчас) — пусто. Исправления без kid-строк ничего не дают.
 */
export function pendingNews(news: readonly NewsEntry[], seen: string, current: string): string[] {
  const from = isVersion(seen) ? seen : current;
  return shown(news, current)
    .filter((n) => compareVersions(n.version, from) > 0)
    .flatMap((n) => n.kid)
    .slice(0, NEWS_KID_MAX);
}

/** Список для родителя: все записи от `NEWS_FROM`, новые сверху. */
export const parentNews = (news: readonly NewsEntry[], current: string): NewsEntry[] => shown(news, current);

/** Игрок увидел всё до `current`: отметка растёт, назад не идёт (старая версия игры не стирает чужой прогресс). */
export function markNewsSeen(seen: Seen, current: string): Seen {
  return isVersion(seen.news) && compareVersions(seen.news, current) >= 0 ? seen : { ...seen, news: current };
}

/**
 * Окно «Игра обновилась» (063-Р58): строки списка «Что нового:» или `null` — окна нет. Показываем, когда старая оболочка увидела пакет
 * новее себя (`shellOld`; списка новой версии она не знает — строки только свои, чаще пусто) и когда у игрока есть непросмотренное
 * (`pending` — `pendingNews`: новичку пусто, окна нет, 010-Р4).
 */
export function updateLines(shellOld: boolean, pending: readonly string[]): string[] | null {
  return shellOld || pending.length > 0 ? [...pending] : null;
}

/** Что знает выбор служебного окна каркаса. */
export interface SystemWindowIn {
  /** Маршрут без служебных окон (`meta.bare`: старт, «Кто играет?», матч, итог, родитель). */
  bare: boolean;
  /** Ответ сеанса сохранения (`status`): окно квоты — только при `quota`. */
  status: string;
  /** Окно квоты закрыто Esc до следующего экрана. */
  laterQuota: boolean;
  /** Окно «Игра обновилась» закрыто Esc у этого игрока. */
  laterUpdate: boolean;
  /** `updateLines`: строки окна обновления или `null`. */
  lines: readonly string[] | null;
}

/**
 * Какое служебное окно показать (063 Т11): `quota` — «Позови взрослого», `update` — «Игра обновилась», `null` — тихо.
 * Квота важнее обновления; пока отказ записи не снят, обновление не показываем (перезагрузка потеряла бы несохранённое из памяти).
 * Если отметка «виденным» перед перезагрузкой не легла — это та же квота: `status` уже `quota`, окно обновления уступает.
 */
export function systemWindow(i: SystemWindowIn): 'quota' | 'update' | null {
  if (i.bare) return null;
  if (i.status === 'quota') return i.laterQuota ? null : 'quota';
  return !i.laterUpdate && i.lines !== null ? 'update' : null;
}
