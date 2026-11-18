/**
 * Образцы для голденов сохранения (060 Т7): разделы-образцы, реестр id и сборка байтов голденов `fmt:1`.
 * Общий источник для `tools/golden-save.mjs` (пишет файлы) и тестов; без vitest, часы и семя — константы здесь.
 * Реестр разделов сборки (`src/app/save/sections.ts`) пока пуст, поэтому голден снят на разделах-образцах:
 * форма конверта и курсового прогресса — настоящая, содержимое `club` — образец. Голден на настоящих разделах
 * Э1 добавляется отдельным файлом и той же командой (`--lock`).
 */
import type { Registry } from '../../src/content/schema/ids';
import type { CourseProgress } from '../../src/engine/course/reconcile';
import type { Device } from '../../src/engine/save/device';
import { createPlayer, serializePlayer, writePlayer, type Envelope } from '../../src/engine/save/envelope';
import type { CourseContext } from '../../src/engine/save/import';
import { isDay, isInt, type SectionDef } from '../../src/engine/save/section';
import { makeSnapshot, serializeSnapshot } from '../../src/engine/save/snapshot';

export const GOLDEN_ORDER = ['ru.yard.ao', 'ru.yard.ao-pairs', 'ru.yard.vl', 'ru.yard.vl-combos'];
export const GOLDEN_REG: Registry = { course: 'ru', released: [...GOLDEN_ORDER], retired: {} };
export const GOLDEN_COURSES: Record<string, CourseContext> = { ru: { reg: GOLDEN_REG, order: GOLDEN_ORDER } };

/** Курсовой раздел: форма — настоящий `CourseProgress`; проверка строгая (целые, день — настоящая дата). */
export const goldenCourseDef: SectionDef<CourseProgress> = {
  name: 'course:ru',
  v: 1,
  empty: () => ({ current: GOLDEN_ORDER[0]!, lessons: {}, archive: {}, leaguesDone: {} }),
  up: {},
  check: (d) => {
    const c = d as Partial<CourseProgress> | null;
    if (!c || typeof c.current !== 'string' || !c.lessons || !c.archive || !c.leaguesDone) return ['shape'];
    const marks = [...Object.values(c.lessons), ...Object.values(c.archive)];
    for (const m of marks) {
      if (!isInt(m.stars) || m.stars < 0 || m.stars > 3 || !isInt(m.best) || !isInt(m.tries)) return ['mark'];
      if (m.done !== undefined && !isDay(m.done)) return ['done'];
    }
    return Object.values(c.leaguesDone).every(isDay) ? [] : ['leaguesDone'];
  },
};

export const goldenClubDef: SectionDef<{ coins: number }> = {
  name: 'club',
  v: 1,
  empty: () => ({ coins: 0 }),
  up: {},
  check: (d) => (d && isInt((d as { coins?: unknown }).coins) && (d as { coins: number }).coins >= 0 ? [] : ['coins']),
};

export const GOLDEN_DEFS = [goldenCourseDef, goldenClubDef] as SectionDef<unknown>[];

/** Версия программы и время снимка «на момент выпуска» — литералы: переименование `APP_VERSION` голден не меняет. */
export const GOLDEN_APP = '2.0.0';
export const GOLDEN_MADE = '2026-11-18T10:00:00.000Z';
export const GOLDEN_FROM = 'https://iliasa101.github.io/keykick/next/';
/** Незнакомые ядру разделы голдена (их «записала» бы программа новее). */
export const GOLDEN_UNKNOWN = ['future:medals', 'league:ru.yard'];

function goldenPlayer(pid: string, name: string, rev: number, club: number): Envelope {
  const base = createPlayer({ pid, name, course: 'ru', explain: 'ru' }, GOLDEN_DEFS);
  const written = writePlayer(base, {
    'course:ru': {
      current: 'ru.yard.vl-combos',
      lessons: {
        'ru.yard.ao': { stars: 3, best: 95, tries: 2, done: '2026-11-01' },
        'ru.yard.ao-pairs': { stars: 2, best: 80, tries: 1, done: '2026-11-02' },
        'ru.yard.vl': { stars: 1, best: 61, tries: 3, done: '2026-11-04' },
      },
      archive: {},
      leaguesDone: {},
    },
    club: { coins: club },
  });
  return {
    ...written,
    rev,
    app: GOLDEN_APP,
    sections: {
      ...written.sections,
      'future:medals': { v: 3, data: { shelf: ['first-goal', 'week'], ratio: 1.5, note: 'не трогать' } },
      'league:ru.yard': { v: 1, data: { gate: 'open', seen: [1, 2, 3] } },
    },
  };
}

export function goldenPlayers(): Envelope[] {
  return [goldenPlayer('golden-a', 'Образец А', 7, 42), goldenPlayer('golden-b', 'Образец Б', 3, 5)];
}

export const GOLDEN_DEVICE: Device = {
  kind: 'keykick-device',
  fmt: 1,
  rev: 4,
  players: [
    { pid: 'golden-a', order: 0 },
    { pid: 'golden-b', order: 1 },
  ],
  uiLang: 'ru',
  sound: { music: 0.5 },
  parent: { gate: 'none' },
};

/** Файл голдена → его байты (строка + перевод строки). Детерминированно: ничего, кроме констант выше. */
export function buildGoldens(): Record<string, string> {
  const [a, b] = goldenPlayers() as [Envelope, Envelope];
  const snap = makeSnapshot(GOLDEN_DEVICE, [a, b], { app: GOLDEN_APP, made: GOLDEN_MADE, from: GOLDEN_FROM });
  return {
    'fmt1.player.json': `${serializePlayer(a)}\n`,
    'fmt1.club.json': `${serializeSnapshot(snap)}\n`,
  };
}
