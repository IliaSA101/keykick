/**
 * Состояние экрана «Путь клуба» (спека 019-Т9, design §6): места лиг по пройденному игроком и клавиша «назад».
 * Состояния мест считает `engine/map/path` (`leagueDone`, 019-Р18) — здесь только склейка с лигами из контента и
 * выбор единственной кнопки. Ничего не пишет в сохранение.
 */
import { computed } from 'vue';
import { courseLessons, leagues } from '../course/load';
import type { League } from '../../engine/course/model';
import { section as courseSection } from '../../engine/course/save';
import { pathModel, type PathPlace } from '../../engine/map/path';
import { sectionRef } from '../save/sections';

export interface PathItem {
  place: PathPlace;
  league: League;
  /** Место, куда ведёт кнопка: текущее или строящееся (карта лиг, которые ещё строятся, — карта Двора). */
  actionable: boolean;
}

/** Места пути с лигами; место без лиги в контенте пропускается. Кнопка — у текущего или строящегося места. */
export function pathItems(places: readonly PathPlace[], all: readonly League[]): PathItem[] {
  const out: PathItem[] = [];
  for (const place of places) {
    const league = all.find((l) => l.id === place.league);
    if (!league) continue;
    // Текущее и строящееся не бывают вместе: модель отдаёт одно «первое не пройденное» место.
    const actionable = place.state === 'current' || place.state === 'building';
    out.push({ place, league, actionable });
  }
  return out;
}

/** Нажатие «назад на карту»: Esc без модификаторов, не удержание и не забранное другим обработчиком. */
export function isBackKey(e: { key: string; repeat: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean; defaultPrevented: boolean }): boolean {
  return e.key === 'Escape' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !e.defaultPrevented;
}

const courseRef = sectionRef(courseSection);

/** Места пути текущего игрока. Пересчитывается после записи прогресса. */
export const pathView = computed(() => pathItems(pathModel(leagues, courseLessons, courseRef.value.passed), leagues));
