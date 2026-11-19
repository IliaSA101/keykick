/**
 * Вид комикса из сеанса (068 Т7): клуб (имя, печать на спине, тренер) и наша группа Кубка → `comicView`; портрет — игровой (068-Р25).
 * Одно место для Дома и стенда кадров. Vue — только `computed`; чтение разделов — `useHomeInput`.
 */
import { computed, type ComputedRef } from 'vue';
import { clubDef, type Club } from '../../engine/club/section';
import { cupDef, cupView, seedOf, type Cup } from '../../engine/cup';
import type { ComicId } from '../../engine/story';
import { useHomeInput } from '../home/useHomeInput';
import { comicView, type ComicView } from './comicView';

export interface ComicShown {
  view: ComicView;
  /** Id тренера (пусто — по умолчанию); портрет подбирает окно (`coachPortrait`, 068-Р25). */
  coach: string;
}

export function useComicView(ask: () => ComicId | null): ComputedRef<ComicShown | null> {
  const { player, data, input, today } = useHomeInput();
  return computed(() => {
    const id = ask();
    const i = input.value;
    if (id === null || !player.value || !i) return null;
    const club = data<Club>(clubDef.name, clubDef.empty());
    const group = id === 'group' ? cupView(data<Cup>(cupDef.name, cupDef.empty()), { cur: i.cur, day: today(), dayN: i.day, pause5: i.pause5, seed: seedOf(player.value.pid) }) : null;
    const view = comicView(id, { club: club.name, backName: club.backName, backNumber: club.backNumber, group: group === null ? null : (group.groups[group.ours] ?? null) });
    return { view, coach: club.coach };
  });
}
