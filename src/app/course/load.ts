// Курс v2: данные — в content, проверка — в движке (тест падает на ошибке в JSON).
// Уроки лиг подхватываются по маске `lessons-*.json`: новая лига — новый файл без строки кода (016-Р8).
import dictionaryJson from '../../content/dictionary.json';
import leaguesJson from '../../content/leagues.json';
import { checkDictionaryFits, parseDictionary, parseLeagueLessons, parseLeagues, type CourseLesson, type Dictionary, type League } from '../../engine/course/model';
import { keymap } from '../keymap';

export const leagues: League[] = parseLeagues(leaguesJson, keymap);

const files = import.meta.glob<unknown>('../../content/lessons-*.json', { eager: true, import: 'default' });

/** Файлы уроков по id лиги (id берётся из имени `lessons-<лига>.json`). */
const byLeague = new Map<string, unknown>();
for (const [path, raw] of Object.entries(files)) {
  const id = /lessons-([a-z]+)\.json$/.exec(path)?.[1];
  if (id) byLeague.set(id, raw);
}

for (const id of byLeague.keys()) {
  if (!leagues.some((l) => l.id === id)) throw new Error(`lessons-${id}.json: league ${id} is not in leagues.json`);
}

/** Уроки всех лиг глубины `full` и `base`, подряд по каркасу; у `frame` файла быть не должно. */
export const courseLessons: CourseLesson[] = leagues.flatMap((league) => {
  const raw = byLeague.get(league.id);
  if (league.depth === 'frame') {
    if (raw !== undefined) throw new Error(`lessons-${league.id}.json: league ${league.id} is a frame, file not expected`);
    return [];
  }
  if (raw === undefined) throw new Error(`lessons-${league.id}.json: file for league ${league.id} (${league.depth}) is missing`);
  return parseLeagueLessons(raw, keymap, league);
});

/** Словарь курса; фразы и кричалки сверены с самой узкой строкой атаки. */
export const dictionary: Dictionary = parseDictionary(dictionaryJson, keymap, 'ru');
checkDictionaryFits(dictionary, Math.min(...courseLessons.map((l) => l.rowWidth)));
