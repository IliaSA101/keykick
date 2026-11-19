/** Матч (060-Т9б): редьюсер `step`, правила, итог и переигровка. Часы и случайность — только из событий и семени. */
export { idleMatch, step } from './machine';
export { replay, replayWithEffects } from './replay';
export { attackOutcome, DEFAULT_RULES, snapshotRules } from './rules';
export { isDraw, replayOf, verdictOf } from './verdict';
export type * from './types';
export { penaltyDue, penaltyScored } from './penalty';
export { assistOf, assistRules, backAfter, failsAfter, helpOf, isComeback, restOffered, soften } from './help';
export type { Help } from './help';
export { newStars, permille, starCap, starsOf } from './stars';
export type { Assist, Stars } from './stars';
export { recordOf } from './record';
export type { RecordKind, RecordValue, RecordView } from './record';
export { playStats, totalOf } from './verdict';
export { finishMatch, finishMinute, matchPatch, minutePatch } from './finish';
export type { FinishCtx, MatchSave, Missing, MinuteSave, MinuteView, ResultView } from './finish';
