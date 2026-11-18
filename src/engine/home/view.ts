/**
 * `homeView` и `yardOf` (065 К-Д): всё, что экран Дома показывает, одним значением — экран ничего не считает.
 */
import type { CupCard, Dream, HomeInput, HouseView, MainAction } from './input';
import { cupCard, dreamOf, houseState, mainAction } from './rules';
import { headFans, headStars, stadiumView, type StadiumView } from './stadium';
import { isAway, isControl, stageOf, streetName, streetOf } from './yard';

export interface HomeView {
  main: MainAction;
  cup: CupCard;
  houses: { school: HouseView; locker: HouseView; base: HouseView; museum: HouseView };
  dream: Dream;
  stadium: StadiumView;
  stars: ReturnType<typeof headStars>;
  fans: ReturnType<typeof headFans>;
  coins: number;
}

export function homeView(i: HomeInput): HomeView {
  return {
    main: mainAction(i),
    cup: cupCard(i),
    houses: { school: houseState('school', i), locker: houseState('locker', i), base: houseState('base', i), museum: houseState('museum', i) },
    dream: dreamOf(i),
    stadium: stadiumView(i),
    stars: headStars(i),
    fans: headFans(i),
    coins: i.coins,
  };
}

/** Двор урока: ступень, соперник (имя — из content), дома или в гостях, контрольный ли. */
export function yardOf(lesson: number): { stage: number; street: string; away: boolean; control: boolean } {
  return { stage: stageOf(lesson), street: streetName(streetOf(lesson)), away: isAway(lesson), control: isControl(lesson) };
}
