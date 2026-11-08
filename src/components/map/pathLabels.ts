// Подписи «Пути клуба» (спека 019-Т9, design §6): что написать у места лиги. Только текст по готовой модели
// `engine/map/path`; состояния и счёт клавиш считает движок. Склонение — `i18n/plural`.
import type { League } from '../../engine/course/model';
import type { PathPlace } from '../../engine/map/path';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import { fill } from './labels';

/** Место пути вместе с лигой из контента. */
export interface PathItem {
  place: PathPlace;
  league: League;
  /** Единственное место, куда ведёт кнопка: текущее или строящееся. */
  actionable: boolean;
}

export interface PathLabel {
  /** Название места; в тумане его нет (кроме кубка мира). */
  name: string;
  state: string;
  /** Строки под названием: что нового в следующем месте, главный кубок. */
  lines: string[];
}

/** Подписи места: имя, состояние и пояснения. */
export function placeLabel(item: PathItem): PathLabel {
  const t = ru.clubPath;
  const { place, league } = item;
  const lines: string[] = [];
  if (place.keys !== null) {
    lines.push(
      place.keys > 0
        ? fill(t.next, { n: place.keys, w: plural(place.keys, t.keysWord), stadium: league.stadium })
        : fill(t.stadiumOnly, { stadium: league.stadium }),
    );
  }
  if (place.progress) lines.push(fill(ru.clubPath.progress, { done: place.progress.done, total: place.progress.total }));
  if (place.alwaysVisible) lines.push(fill(t.mainCup, { cup: league.cup }));
  const hidden = place.state === 'fog' && !place.alwaysVisible;
  return { name: hidden ? '' : league.name, state: t.state[place.state], lines };
}

/** Подпись кнопки текущего места для диктора: всё, что видно в карточке, и действие. Карточка при этом скрыта от диктора. */
export function openLabel(item: PathItem): string {
  const l = placeLabel(item);
  return [l.name, l.state, ...l.lines, ru.clubPath.open].filter((s) => s !== '').join('. ');
}

/** Подпись главной кнопки экрана: «К уроку N» пока есть что играть в текущей лиге, потом — повторять за звёздами (019-Р37). */
export function mainActionLabel(items: readonly PathItem[]): string {
  const n = items.find((i) => i.place.state === 'current')?.place.lessonN ?? null;
  return n === null ? ru.clubPath.review : fill(ru.clubPath.toLesson, { n });
}
