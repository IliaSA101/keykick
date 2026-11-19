/**
 * Вход Карты Двора из сеанса (065 Т8): те же разделы и тот же `homeInputOf`, что у Дома, — Карта не считает ничего своего.
 * Вход собирает `useHomeInput` (общий с Домом). Стенд кадров (065-Р64) подмешивает поставщиков следующих волн через `kk-home-stand`, как у Дома.
 */
import { computed, inject } from 'vue';
import { useHomeInput } from '../../app/home/useHomeInput';
import type { ClubKit } from '../../engine/club/section';
import type { HomeInput } from '../../engine/home';
import type { MapInput } from '../../engine/map';

type Stand = { seed?: number; over?: Partial<HomeInput>; travel?: boolean; pick?: number; win?: string; hardKeys?: string[] } | null;

export function useMapInput() {
  const stand = inject<(() => Stand) | null>('kk-home-stand', null)?.() ?? null;
  const { session, pack, player, data, facts, input: home, lessonName } = useHomeInput(stand?.over);
  const map = computed<MapInput | null>(() => {
    const h = home.value;
    const f = facts.value;
    if (!h || !f) return null;
    return { cur: h.cur, stars: h.stars, end: h.end, friendly: new Set(f.order.flatMap((id, i) => (f.friendly.has(id) ? [i + 1] : []))) };
  });
  const club = computed(() => data<{ name: string; city: string; kit?: ClubKit }>('club', { name: '', city: '' }));
  const lessonId = (n: number): string | undefined => pack.pack.value?.lessons.order[n - 1];
  return { session, stand, pack, player, home, map, club, lessonId, lessonName, data };
}
