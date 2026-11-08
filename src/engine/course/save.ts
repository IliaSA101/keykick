/**
 * Раздел `course` (спека 018 design §3.1, смысл полей — 017 design §10): текущий урок, пройденные, рекорды по урокам.
 * Незнакомые id хранятся (014-В2): каталог разбор не фильтрует. Владелец — 017.
 */
import { defineSection, int, type SectionDef } from '../save/section';

export type Help = 'none' | 'reserve' | 'coach';

export interface LessonRecord {
  /** Лучшие звёзды, 0–3. */
  stars: number;
  /** Рекорд, знаков в минуту, 0–2000. */
  cpm: number;
  /** Рекорд точности, тысячные 0–1000. */
  acc: number;
  /** Провалов подряд (017 §4). */
  fails: number;
  /** «С запасом» / «С тренером». */
  help: Help;
  /** «Вернуться за звёздами». */
  back: boolean;
}

export interface CourseSave {
  /** Текущий урок `yard-NN`; '' — первый урок курса (решает 016 при показе). */
  lesson: string;
  /** Пройденные, без повторов, в порядке прохождения. */
  passed: string[];
  lessons: Record<string, LessonRecord>;
}

/** Потолки — защита от мусора: уроков в курсе 200, запас на Э2–Э6. */
export const COURSE_LESSONS_MAX = 400;
export const ID_MAX = 40;
export const FAILS_MAX = 1000;

export const helps: readonly Help[] = ['none', 'reserve', 'coach'];

const rec = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const id = (v: unknown): string => (typeof v === 'string' ? v.trim().slice(0, ID_MAX) : '');

function parseRecord(raw: unknown): LessonRecord {
  const r = rec(raw);
  return {
    stars: int(r.stars, 0, 3),
    cpm: int(r.cpm, 0, 2000),
    acc: int(r.acc, 0, 1000),
    fails: int(r.fails, 0, FAILS_MAX),
    help: helps.find((h) => h === r.help) ?? 'none',
    back: r.back === true,
  };
}

export const section: SectionDef<CourseSave> = defineSection<CourseSave>({
  name: 'course',
  owner: '017',
  parse: (raw) => {
    const r = rec(raw);
    const passed = [...new Set((Array.isArray(r.passed) ? r.passed : []).filter((x): x is string => typeof x === 'string' && x !== '' && id(x) === x))].slice(0, COURSE_LESSONS_MAX);
    const lessons = Object.fromEntries(
      Object.entries(rec(r.lessons))
        .filter(([k]) => k !== '' && id(k) === k)
        .slice(0, COURSE_LESSONS_MAX)
        .map(([k, v]) => [k, parseRecord(v)]),
    );
    return { lesson: id(r.lesson), passed, lessons };
  },
  empty: () => ({ lesson: '', passed: [], lessons: {} }),
  sample: () => ({
    lesson: 'yard-03',
    passed: ['yard-01', 'yard-02'],
    lessons: {
      'yard-01': { stars: 3, cpm: 87, acc: 950, fails: 0, help: 'none', back: false },
      'yard-02': { stars: 1, cpm: 60, acc: 800, fails: 2, help: 'reserve', back: true },
    },
  }),
  // Потолок: все уроки каталога пройдены, у каждого запись на максимумах.
  maxSample: (cat) => ({
    lesson: cat.lessonIds[0] ?? 'yard-01',
    passed: [...cat.lessonIds],
    lessons: Object.fromEntries(
      cat.lessonIds.map((l): [string, LessonRecord] => [l, { stars: 3, cpm: 2000, acc: 1000, fails: FAILS_MAX, help: 'reserve', back: true }]),
    ),
  }),
  // Пройденных и звёзд (лучших) не убывает.
  counters: (s) => ({ passed: s.passed.length, stars: Object.values(s.lessons).reduce((a, l) => a + l.stars, 0) }),
  check: (s) => {
    const bad: string[] = [];
    if (new Set(s.passed).size !== s.passed.length) bad.push('course.passed: duplicates');
    if (s.passed.length > COURSE_LESSONS_MAX) bad.push('course.passed: too long');
    return bad;
  },
});
