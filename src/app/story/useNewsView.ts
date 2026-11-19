/**
 * Вид выпуска газеты из сеанса (068 Т7): разделы игрока → факты (`paperFacts`) → вид (`paperView`). Одно место для Дома, Музея и стенда кадров.
 * Длинные имя и город (`longName`, `longCity`) — только стенд кадров: проверка края «клуб 40 знаков» (в сохранении имя ≤ 20, `NAME_MAX`).
 * Vue — только `computed`; чтение разделов и названий уроков — `useHomeInput`.
 */
import { computed, type ComputedRef } from 'vue';
import { coachNameOf } from '../../engine/club/start';
import { clubDef, type Club } from '../../engine/club/section';
import { useHomeInput } from '../home/useHomeInput';
import { newsViewOf, type NewsWho } from './newsOf';
import { paperSectionsOf } from './paperIn';
import type { PaperView } from './paperView';

export interface NewsAsk {
  n: number;
  archive?: boolean;
  longName?: string | undefined;
  longCity?: string | undefined;
}

export interface NewsShown {
  view: PaperView;
  /** Цвет клуба — линия шапки. */
  color: string;
}

/** Кто и где — из клуба и игрока; длинные имя и город (стенд кадров) подменяют клубные. */
const whoOf = (club: Club, name: string, lessonName: (n: number) => string, over: { name?: string | undefined; city?: string | undefined } = {}): NewsWho =>
  ({ club: over.name ?? club.name, city: over.city ?? club.city, player: name, coach: coachNameOf(club.coach), lessonName });

export function useNewsView(ask: () => NewsAsk | null): ComputedRef<NewsShown | null> {
  const { player, data, lessonName } = useHomeInput();
  return computed(() => {
    const a = ask();
    if (a === null || !player.value) return null;
    const club = data<Club>(clubDef.name, clubDef.empty());
    const who = whoOf(club, player.value.env.name, lessonName, { name: a.longName, city: a.longCity });
    return { view: newsViewOf(a.n, paperSectionsOf(data, player.value.pid), who, a.archive === true), color: club.kit.body };
  });
}

/** Виды нескольких выпусков сразу (полка Музея: восемь миниатюр, `archive` — вид из архива): ключ — номер выпуска. */
export function useNewsViews(ns: () => number[]): ComputedRef<{ views: Record<number, PaperView>; color: string } | null> {
  const { player, data, lessonName } = useHomeInput();
  return computed(() => {
    if (!player.value) return null;
    const club = data<Club>(clubDef.name, clubDef.empty());
    const who = whoOf(club, player.value.env.name, lessonName);
    const sections = paperSectionsOf(data, player.value.pid);
    return { views: Object.fromEntries(ns().map((n) => [n, newsViewOf(n, sections, who, true)])), color: club.kit.body };
  });
}
