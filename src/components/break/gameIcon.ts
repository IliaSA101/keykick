/** Картинка игры по id (одна на окно игры и карточки перерыва); нет такой — первая. */
import { artUrl, type ArtKey } from '../../art/assets';

const ICONS: Record<string, ArtKey> = { arrows: 'learnIconPassArrows', mouse: 'learnIconPassMouse', tab: 'learnIconTabDefenders', keyboard: 'learnIconKeyboardBuild', squad: 'learnIconSquadPick', board: 'learnIconScoreboard', roster: 'learnIconMatchSheet', pairs: 'learnIconPairs' };

export const gameIcon = (id: string): string => artUrl(ICONS[id] ?? 'learnIconPassArrows');
