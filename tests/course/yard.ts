/**
 * Общая подготовка тестов плана урока (060-Т9а): пакет `ru.yard` с диска (тесты вправе читать пакет напрямую, страж
 * запрещает это только коду сборки), уроки Двора, словарь и карта клавиатуры. Тот же путь, каким игру будет кормить загрузчик:
 * `parseLessons` + `parseDictionary` на данных пакета и `dictionary.json`.
 */
import dictionaryJson from '../../src/content/dictionary.json';
import ruCourse from '../../src/content/courses/ru/course.json';
import ruFrames from '../../src/content/courses/ru/leagues.json';
import yardManifest from '../../src/content/packs/ru.yard/pack.json';
import yardLessons from '../../src/content/packs/ru.yard/lessons.json';
import yardText from '../../src/content/packs/ru.yard/text.ru.json';
import type { Pack } from '../../src/content/schema/pack';
import { checkDictionaryFits, parseDictionary } from '../../src/engine/plan/dictionary';
import type { CourseLesson, Dictionary } from '../../src/engine/plan/lesson';
import { parseLessons, type LessonsContext } from '../../src/engine/plan/parseLessons';
import { keymap } from '../../src/engine/typing/layouts';

export { keymap };

/** Раскладка курса `ru` — из его `course.json`. */
export const LAYOUT = ruCourse.layout;

export const yardPack = { manifest: yardManifest, lessons: yardLessons, text: { ru: yardText } } as unknown as Pack;

export const yardContext: LessonsContext = { lang: 'ru', layout: LAYOUT, keymap, league: 'yard', lessons: ruFrames.find((f) => f.id === 'yard')!.lessons };

/** Уроки Двора, как их читает игра. */
export const courseLessons: CourseLesson[] = parseLessons(yardPack, yardContext);

/** Словарь курса `ru`; фразы и кричалки сверены с самой узкой строкой атаки. */
export const dictionary: Dictionary = parseDictionary(dictionaryJson, keymap, LAYOUT, 'ru');
checkDictionaryFits(dictionary, Math.min(...courseLessons.map((l) => l.rowWidth)));
