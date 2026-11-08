// Раскладки карт лиг (спека 019, design §4.1): файлы `map-<лига>.json` подхватываются по маске, как уроки курса.
// Новая лига — новый файл без строки кода; разбор бросает с путём, если файл не сходится с каркасом лиг.
import { courseLessons, leagues } from '../course/load';
import { parseMapLayout, type MapLayout } from '../../engine/map/layout';

const files = import.meta.glob<unknown>('../../content/map-*.json', { eager: true, import: 'default' });

export const layouts: MapLayout[] = Object.values(files).map((raw) => parseMapLayout(raw, leagues, courseLessons));

const seen = new Set<string>();
for (const l of layouts) {
  if (seen.has(l.league)) throw new Error(`map-${l.league}.json: two files for league ${l.league}`);
  seen.add(l.league);
}

/** Раскладка карты лиги; у лиги `frame` карты нет — это нормально. */
export const layoutOf = (leagueId: string): MapLayout | undefined => layouts.find((l) => l.league === leagueId);
