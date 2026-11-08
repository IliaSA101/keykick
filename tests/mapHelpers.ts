/**
 * Общая подготовка тестов экрана карты (спека 019-Т7…Т9): номера уроков Двора и вход модели карты.
 * Файлы: `mapScreen.test.ts` (карта, клавиатура, сиды), `mapChrome.test.ts` (шапка, окна), `pathScreen.test.ts`.
 */
import { courseLessons, leagues } from '../src/app/course/load';
import mapYard from '../src/content/map-yard.json';
import { parseMapLayout } from '../src/engine/map/layout';
import type { MapInput } from '../src/engine/map/model';

export const yardId = (n: number) => `yard-${String(n).padStart(2, '0')}`;
export const yardIds = (ns: number[]) => ns.map(yardId);
export const yardLeague = leagues.find((x) => x.id === 'yard')!;
export const mapInput = (passed: string[], over: Partial<MapInput> = {}): MapInput => ({
  league: yardLeague, lessons: courseLessons, layout: parseMapLayout(mapYard, leagues, courseLessons), nextLeague: leagues[1]!, passed,
  records: {}, half2: null, provided: {}, ...over,
});
