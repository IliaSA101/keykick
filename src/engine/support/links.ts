/**
 * Ссылки для взрослого (068-Р10, Р11, Р82; 059-В4, В5): раньше — конец Двора и страница родителя, теперь — меню игрока в шапке. Отзыв — Telegram и форма (владелец 19.11),
 * донат — шов: адрес из `support.json`, пока он пуст — ссылки нет. Чистая функция: адреса приходят снаружи.
 * Адрес берём только `https://`: чужая строка из JSON не должна стать `javascript:`.
 */
export type ParentLinkKind = 'telegram' | 'form' | 'donate';

export interface ParentLink {
  kind: ParentLinkKind;
  url: string;
}

export interface LinkSources {
  telegram: string;
  form: string;
  donate: string;
}

const ORDER: readonly ParentLinkKind[] = ['telegram', 'form', 'donate'];

/** Показываемые ссылки в порядке «отзыв (Telegram), форма, донат»; пустые и небезопасные адреса отброшены. Пусто — блока нет вовсе. */
export function parentLinks(src: LinkSources): ParentLink[] {
  return ORDER.map((kind) => ({ kind, url: src[kind].trim() })).filter((l) => /^https:\/\/\S+$/.test(l.url));
}

/** Действия игрока в меню шапки (068-Р82): сменить игрока, «Что нового · vX.Y» (строка без действия, 063-Р67), старая версия. */
export type PlayerAction = 'change' | 'news' | 'old';

export interface PlayerMenu {
  actions: readonly PlayerAction[];
  /** Ссылки для взрослого под разделителем; пусто — раздела нет вовсе (ни разделителя, ни подписи). */
  adults: ParentLink[];
}

/** Состав меню игрока в шапке: действия всегда те же, взрослому — отзыв и форма, донат — только когда адрес в `support.json` не пуст. */
export function playerMenu(src: LinkSources): PlayerMenu {
  return { actions: ['change', 'news', 'old'], adults: parentLinks(src) };
}
