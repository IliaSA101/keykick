/**
 * Сиды v2 для кадров (спека 019, design §9): `?seed=v2-…` кладёт в хранилище готовое состояние клуба и карты.
 * Чистое хранилище делает вызывающий (`dev/seed.ts`, `wipe`) до сида; здесь — только то, что сверх чистого листа.
 * Сохранение пишется конвертом 014/018 (`nextEnvelope`) по разделам — как его пишет слой; в приложение при загрузке
 * сохранение проходит обычный разбор. Сейчас: `v2-fresh` (Т6), `v2-day1`, `v2-mid`, `v2-end` (Т7); `v2-two` — Т13.
 * Грузится до `app/players`: модулей приложения с игроками и слоем сохранения (`app/club`, `app/save`) не трогает.
 */
import coachJson from '../content/coach.json';
import { clubData } from '../app/kits';
import { courseLessons } from '../app/course/load';
import { PLAYERS_KEY, saveKey, writeJson } from '../app/storage';
import { APP_VERSION } from '../app/version';
import { defaultCoach, parseCoachData } from '../engine/coach/coach';
import type { CourseSave, LessonRecord } from '../engine/course/save';
import { section as matchSection } from '../engine/match/save';
import { nextEnvelope } from '../engine/save/format';
import { ru } from '../i18n/ru';

export const V2_SEEDS = ['v2-fresh', 'v2-day1', 'v2-mid', 'v2-end'] as const;
export type V2SeedName = (typeof V2_SEEDS)[number];

/** Время «последнего матча» в сидах: не ноль, чтобы пузырь тренера не показывался. */
const PLAYED_AT = 1_800_000_000_000;

const yardIds = courseLessons.filter((l) => l.league === 'yard').sort((a, b) => a.n - b.n).map((l) => l.id);

/**
 * Запись урока: звёзды вперемешку (0–3 по номеру), рекорд растёт с номером. Кольцо «вернуться за звёздами» у 5 и 11 —
 * как в игре: урок пройден с «запасом» и звёзд меньше трёх (одна звезда).
 */
function record(n: number): LessonRecord {
  const back = n === 5 || n === 11;
  return { stars: back ? 1 : (n * 7) % 4, cpm: 40 + n * 3, acc: 900 + (n % 5) * 20, fails: 0, help: back ? 'reserve' : 'none', back };
}

/** Раздел `club` сида: клуб «Прогресс» из Твери, создан давно (карта и охрана входа его видят). */
export function sampleClub(): Record<string, unknown> {
  const palette = clubData.palettes[1] ?? clubData.palettes[0];
  if (!palette) throw new Error('seed: no club palettes');
  return {
    name: ru.firstRun.sample.name,
    kit: palette,
    city: ru.firstRun.sample.city,
    coach: defaultCoach(parseCoachData(coachJson)).id,
    rival: '',
    createdAt: PLAYED_AT - 1,
    newsSeen: APP_VERSION,
  };
}

/** Один игрок `p1` с клубом «Прогресс» из Твери и заданным курсом. */
function writePlayer(course: CourseSave, over: { half2?: boolean; played: boolean; coins: number }): void {
  const match = matchSection.empty({});
  const sections = {
    club: sampleClub(),
    course,
    match: {
      ...match,
      lastFinishedAt: over.played ? PLAYED_AT : 0,
      half2: over.half2
        ? { lessonId: 'yard-17', seed: 1, started: 0, score: [1, 0] as [number, number], first: { correct: 40, errors: 2, ms: 30_000 }, reason: 'break' as const }
        : null,
    },
    // Раздел кошелька трогает только касса (страж ТЗ-0.3): сид кладёт сырой конверт, слой разберёт его при загрузке.
    wallet: { coins: over.coins, pressRest: 0, stakeRest: 0, earned: over.coins, spent: 0 },
  };
  writeJson(saveKey('p1'), nextEnvelope({ rev: 0 }, sections, APP_VERSION));
  writeJson(PLAYERS_KEY, { players: [{ id: 'p1', name: ru.firstRun.sample.name }], current: 'p1', lastId: 1 });
}

/** Пройденные первые `count` уроков Двора с записями; текущий — следующий. */
function courseAfter(count: number): CourseSave {
  const passed = yardIds.slice(0, count);
  return {
    lesson: yardIds[count] ?? '',
    passed,
    lessons: Object.fromEntries(passed.map((id, i) => [id, record(i + 1)])),
  };
}

const FIXTURES: Record<V2SeedName, () => void> = {
  // Игрок без клуба: приложение само заведёт одного игрока при старте — это и есть первый запуск.
  'v2-fresh': () => undefined,
  // Клуб есть, ничего не сыграно: на карте пузырь тренера, точка 1 в фокусе.
  'v2-day1': () => writePlayer(courseAfter(0), { played: false, coins: 0 }),
  // 1–16 пройдены, кольцо у 5 и 11, ожидающий 2-й тайм на уроке 17, 230 монет.
  'v2-mid': () => writePlayer(courseAfter(16), { half2: true, played: true, coins: 230 }),
  // Все 32 пройдены: ворота Района «строится».
  'v2-end': () => writePlayer(courseAfter(32), { played: true, coins: 900 }),
};

export function isV2Seed(name: string): name is V2SeedName {
  return (V2_SEEDS as readonly string[]).includes(name);
}

/** Положить сид v2 поверх чистого хранилища. */
export function applyV2Seed(name: V2SeedName): void {
  FIXTURES[name]();
}
