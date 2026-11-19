/**
 * «На матч» (065-Р171): из Дома и с Пути клуба — сразу переезд на Карте (чип «Карта» — просто Карта). Один помощник на оба
 * экрана (066 Т6). Вторая вкладка (`busy`, `readonly`) — холостое действие: сеанс не `ok` — никуда не идём.
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { useSession } from '../save/session';

export function useGoMatch(session: ReturnType<typeof useSession>) {
  const router = useRouter();
  const canPlay = computed(() => session.status.value === 'ok');
  function go(): void {
    if (!canPlay.value) return;
    void router.push({ path: '/map', query: { travel: '1' } });
  }
  return { canPlay, go };
}
