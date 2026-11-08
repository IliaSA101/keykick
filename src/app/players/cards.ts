/**
 * Карточки «Кто играет?» (спека 019-Т13, design §12): клуб и урок игрока — из разделов v2 (`club`, `course`),
 * а не из сохранения v1. Сохранения читаются без записи (`saveStore.peek`): битое или чужое — чистое.
 */
import { hasClub, type ClubFields } from '../../engine/club/create';
import { clubKit } from '../../engine/club/kit';
import { section as clubSection } from '../../engine/club/save';
import { section as courseSection, type CourseSave } from '../../engine/course/save';
import type { Kit } from '../../engine/kit';
import { courseLessons } from '../course/load';
import { players, playingId } from './list';
import { saveStore } from '../save/instance';

export interface PlayerCardData {
  id: string;
  name: string;
  /** Название клуба; null — клуб ещё не создан. */
  club: string | null;
  kit: Kit | null;
  /** Номер урока с единицы: по `course.lesson`; пустой или незнакомый — первый. */
  lesson: number;
  playing: boolean;
}

/** Номер урока для карточки: место id среди уроков курса, считая с единицы; нет такого — 1. */
export function lessonNumber(lessonId: string, ids: readonly string[]): number {
  const at = ids.indexOf(lessonId);
  return at < 0 ? 1 : at + 1;
}

/** Карточки всех игроков списка. Читаются один раз: пока экран открыт, прогресс игроков не меняется. */
export function playerCards(): PlayerCardData[] {
  const ids = courseLessons.map((l) => l.id);
  return players.players.map((p) => {
    const saved = saveStore.peek(p.id);
    const club = saved[clubSection.name] as ClubFields | undefined;
    const course = saved[courseSection.name] as CourseSave | undefined;
    const has = club !== undefined && hasClub(club);
    return {
      id: p.id,
      name: p.name,
      club: has ? club.name : null,
      kit: has ? clubKit(club) : null,
      lesson: lessonNumber(course?.lesson ?? '', ids),
      playing: p.id === playingId.value,
    };
  });
}
