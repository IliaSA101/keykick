/** Портрет тренера на белом (Э2К.34): один на выбор при первом запуске и на смену в «Клубе». */
import { artUrl, type ArtKey } from '../../art/assets';

const KEYS: Record<string, ArtKey> = {
  young: 'coachPickYoung',
  veteran: 'coachPickVeteran',
  ponytail: 'coachPickPonytail',
  bigbeard: 'coachPickBigbeard',
};

export const coachPortrait = (id: string): string => artUrl(KEYS[id] ?? 'coachPickYoung');
