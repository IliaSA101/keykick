/**
 * Состояние карты для экрана (спека 019, design §5.2): что карте дают курс и матч, реестр поставщиков
 * (замки кубка и зданий от 021, 022, 024, 026, 037, 040), выбор лиги, модель `computed`, монеты шапки (только показ,
 * `engine/wallet/view`, 018-Р25 — страж кассы ТЗ-0.3 не пускает чтение мимо него). Расчёт — в `engine/map`;
 * здесь только сборка входа из разделов сохранения. Реестр собирает `import.meta.glob` (В4): поставщик, который
 * регистрировался бы при загрузке своего модуля, к ленивому экрану карты не успел бы.
 */
import { computed } from 'vue';
import { courseLessons, leagues } from '../course/load';
import type { CourseLesson, League } from '../../engine/course/model';
import { section as courseSection } from '../../engine/course/save';
import { buildingFocus, flagFocus } from '../../engine/map/focus';
import { buildingIds, type BuildingId, type MapLayout } from '../../engine/map/layout';
import { buildMapModel, isPlayablePoint, playable, type MapInput, type MapModel, type MapProvided } from '../../engine/map/model';
import { section as matchSection, type MatchSave } from '../../engine/match/save';
import { coinsOf, walletKey } from '../../engine/wallet/view';
import { sectionRef } from '../save/sections';
import { layouts } from './load';

type ProviderModule = { provide?: MapProvided };

/** Поставщики: `src/app/<подсистема>/mapProvide.ts`. Путь файла → модуль. */
export const providerModules: Record<string, ProviderModule> = import.meta.glob<ProviderModule>('../*/mapProvide.ts', { eager: true });

/**
 * Свести поставщиков в один. Файл без `provide` и два поставщика одного места (кубок, здание) — ошибка при сборке
 * реестра, а не тихая подмена: тест «все поставщики в реестре» ловит её до выкладки.
 */
export function collectProvided(mods: Record<string, ProviderModule>): MapProvided {
  let cup: MapProvided['cup'];
  let cupFrom = '';
  const buildings: NonNullable<MapProvided['buildings']> = {};
  const from: Partial<Record<BuildingId, string>> = {};
  for (const [path, mod] of Object.entries(mods)) {
    const p = mod.provide;
    if (!p) throw new Error(`${path}: no provide export (MapProvided)`);
    if (p.cup) {
      if (cup) throw new Error(`${path}: cup is already provided by ${cupFrom}`);
      cup = p.cup;
      cupFrom = path;
    }
    for (const id of buildingIds) {
      const one = p.buildings?.[id];
      if (!one) continue;
      const other = from[id];
      if (other !== undefined) throw new Error(`${path}: building ${id} is already provided by ${other}`);
      buildings[id] = one;
      from[id] = path;
    }
  }
  return { ...(cup ? { cup } : {}), buildings };
}

/**
 * Лига карты: лига урока `course.lesson`; пустой или незнакомый — первая лига с уроками. Лига без раскладки
 * (пока карта одна — Двор) уступает первой, у которой раскладка есть. Нет ни одной — `null`.
 */
export function pickLeague(
  allLeagues: readonly League[],
  lessons: readonly CourseLesson[],
  maps: readonly Pick<MapLayout, 'league'>[],
  lessonId: string,
): League | null {
  const has = (l: League): boolean => maps.some((m) => m.league === l.id);
  const own = allLeagues.find((l) => l.id === lessons.find((x) => x.id === lessonId)?.league);
  if (own && has(own)) return own;
  return allLeagues.find((l) => has(l) && lessons.some((x) => x.league === l.id)) ?? null;
}

/** Вход модели карты из разделов сохранения; `null` — карты нет ни у одной лиги. */
export function mapInputOf(
  course: { lesson: string; passed: readonly string[]; lessons: Readonly<Record<string, { stars: number; back: boolean }>> },
  match: { half2: Readonly<{ lessonId: string; score: readonly number[] }> | null },
  provided: MapProvided,
): MapInput | null {
  const league = pickLeague(leagues, courseLessons, layouts, course.lesson);
  const layout = layouts.find((l) => l.league === league?.id);
  if (!league || !layout) return null;
  const records: Record<string, { stars: number; back: boolean }> = {};
  for (const [id, r] of Object.entries(course.lessons)) records[id] = { stars: r.stars, back: r.back };
  return {
    league,
    lessons: courseLessons,
    layout,
    nextLeague: leagues[leagues.indexOf(league) + 1] ?? null,
    passed: course.passed,
    records,
    half2: match.half2 ? { lessonId: match.half2.lessonId, score: [match.half2.score[0] ?? 0, match.half2.score[1] ?? 0] } : null,
    provided,
  };
}

/** Тренер здоровается, пока не доигран ни один матч (019-Р3): выводится из сохранения, отдельной отметки нет. */
export const coachGreets = (match: Pick<MatchSave, 'lastFinishedAt'>): boolean => match.lastFinishedAt === 0;

/**
 * Фокус из адреса `#/map?focus=…` — быстрая проверка, только в dev-сборке. Принимает `yard-05`, `gate`,
 * `flag-9` / `flag:9`, `building-stadium`; незнакомое и выпуск — фокус по умолчанию.
 */
export function focusFromQuery(raw: unknown, model: MapModel, dev: boolean): string {
  if (!dev || typeof raw !== 'string') return model.focus;
  const id = raw.replace(/^(flag|building)-/, '$1:');
  // Только то, что можно сфокусировать: играемые точки и ворота не в тумане (иначе ни один элемент не получит фокус).
  const known = [
    ...model.points.filter(isPlayablePoint).map((p) => p.id),
    ...(model.gate.state === 'fog' ? [] : ['gate']),
    ...model.flags.map((f) => flagFocus(f.after)),
    ...model.buildings.map((b) => buildingFocus(b.id)),
  ];
  return known.includes(id) ? id : model.focus;
}

const courseRef = sectionRef(courseSection);
const matchRef = sectionRef(matchSection);
const walletRef = sectionRef(walletKey);

/** Монеты в шапке: только показ через `wallet/view` (018-Р25), касса не нужна. */
export const coins = computed(() => coinsOf(walletRef.value));

const provided = collectProvided(providerModules);

/** Модель карты текущего игрока; `null` — карт нет (контент без раскладок). Пересчитывается после записи. */
export const mapModel = computed<{ input: MapInput; model: MapModel } | null>(() => {
  const input = mapInputOf(courseRef.value, matchRef.value, provided);
  return input ? { input, model: buildMapModel(input) } : null;
});

/** Пузырь тренера на карте. */
export const greeting = computed(() => coachGreets(matchRef.value));

/** Рекорд урока, знаков в минуту; 0 — не играно. */
export const cpmOf = (lessonId: string): number => courseRef.value.lessons[lessonId]?.cpm ?? 0;

/** Играется ли урок сейчас — для охраны адреса матча (Т11) и кнопок карты. Одна функция с моделью. */
export const playableNow = (lessonId: string): boolean =>
  playable({ leagues, lessons: courseLessons, passed: courseRef.value.passed }, lessonId);
