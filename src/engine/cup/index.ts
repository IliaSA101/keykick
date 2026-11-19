/** Подсистема `cup` (Кубок Двора, 068-Т1): модель, раздел сохранения, вид для экрана. Урок матча, серия ударов и `finishCup` — 068-Т2. */
export { cupDef, emptyCup, recordTour, recordKo, claimPack } from './section';
export { cupView, cupMilestones, rivalFor } from './view';
export { cupRound, roundStates, cupStage, anchorOf, ROUND_KEYS, KO_ROUNDS } from './rounds';
export { seedOf, ourPlace, groupTable, groupMatches } from './group';
export { bracketOf, koRival, qualifiers } from './bracket';
export { rivalOf, teamOf, TEAMS, THROUGH_TEAM } from './teams';
export { cupLesson, extraTime, CUP_BOOST, weakFingerKeys } from './lesson';
export { seriesStep, seriesResult, seriesWord, idleSeries, SERIES_LENGTHS, SERIES_WIN } from './series';
export type { SeriesState, RunningSeries, SeriesEvent, SeriesStart, SeriesKey, SeriesEffect, SeriesResult, Shot } from './series';
export { finishCup, cupPatch, PRIZE_GROUP, PRIZE_SEMI, PRIZES_TITLE } from './finish';
export type { CupSave, CupFinishCtx, CupFact, CupResultView } from './finish';
export type * from './types';
