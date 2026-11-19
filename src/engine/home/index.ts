/** Подсистема `home` (065-Т5): правила Дома, стадион, раздел `stadium`. Вход — `HomeInput`, выход — ключи и числа. */
export { cupCard, dreamOf, goldHint, houseState, mainAction, paperFresh, paperFreshMark, paperMarkOnHome, regionSignShown, systemOpen } from './rules';
export { EDGE, MAIN_BOTTOM, MAIN_TALL_H, STAGE_H, TAG_GAP, TAG_H, mainWidth, placeHalf, placeX, standTop } from './layout';
export { hasSector, headFans, headStars, seatsOf, stadiumView } from './stadium';
export type { StadiumView } from './stadium';
export { addGoals, emptyStadium, stadiumDef } from './section';
export type { Stadium } from './section';
export { isAway, isControl, isHomeRound, lessonsOf, ROUNDS, stageOf, stageRange, streetName, streetOf } from './yard';
export type { CupCard, CupData, Dream, HomeExtras, HomeInput, HouseEvent, HouseId, HouseView, MainAction } from './input';
export { homeView, yardOf } from './view';
