/**
 * «На матч» (065-Р171): из Дома и с Пути клуба — сразу переезд на Карте (чип «Карта» — просто Карта). Один помощник на оба
 * экрана (066 Т6). Вторая вкладка (`busy`, `readonly`) — холостое действие: сеанс не `ok` — никуда не идём.
 * Если на главной кнопке раунд Кубка (`input.round`) и он играется сейчас — матч Кубка `/match?cup=<раунд>` (068 Т6), иначе Карта.
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { RoundKey } from '../../engine/cup';
import { cupDef, type Cup } from '../../engine/cup';
import { cupViewFor, playableRound } from '../cup/run';
import type { useSession } from '../save/session';
import { useHomeInput } from './useHomeInput';

export function useGoMatch(session: ReturnType<typeof useSession>) {
  const router = useRouter();
  const canPlay = computed(() => session.status.value === 'ok');
  const home = useHomeInput();
  /** Раунд Кубка для кнопки «Играть»: только если у входа Дома есть раунд и он открыт или на переигровке. */
  const cupRound = computed<RoundKey | null>(() => {
    const i = home.input.value;
    const p = home.player.value;
    if (!i || !p || i.round === null) return null;
    const cup = (p.env.sections[cupDef.name]?.data as Cup | undefined) ?? cupDef.empty();
    return playableRound(cupViewFor(cup, i, home.today(), p.pid).next);
  });
  function go(): void {
    if (!canPlay.value) return;
    if (cupRound.value !== null) return void router.push({ path: '/match', query: { cup: cupRound.value } });
    void router.push({ path: '/map', query: { travel: '1' } });
  }
  return { canPlay, go };
}
