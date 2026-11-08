/**
 * Ход матчдэя после итога (спека 019-Т10, design §7): снимок «до матча» в потоке, `createMatchday` на заглушках и реестр шагов.
 * Отдельно от `map.test.ts` (тот рядом с пределом 400 строк): здесь другая подготовка — поток настоящего матча и фальшивый переход.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { courseLessons } from '../src/app/course/load';
import { MAP_PATH } from '../src/app/map/go';
import { createMatchFlow } from '../src/app/match/flow';
import { drive, jumpWith } from '../src/app/match/jump';
import { matchRules } from '../src/app/match/load';
import { memoryMatchStore } from '../src/app/match/store';
import { createMatchday } from '../src/app/matchday/run';
import { collectSteps, stepModules, steps, type AppStep } from '../src/app/matchday/steps';
import { resultModel, type ResultExtras } from '../src/engine/matchResult/resultModel';
import type { StepKind } from '../src/engine/matchday/queue';
import type { MatchSummary } from '../src/engine/matchday/summary';

const lesson = courseLessons.find((l) => l.id === 'yard-05') ?? courseLessons[4]!;
const dayOf = (t: number): string => new Date(t).toISOString().slice(0, 10);
const extras: ResultExtras = {
  help: 'none', softened: false, paid: true,
  rules: { help: { reserveCap: 2, coachCap: 1 }, threeStar: 0.9, coinPer: 10 } as ResultExtras['rules'],
  correct: 40, coins: 4, carry: 0, growth: [], report: null,
};
const T0 = Date.UTC(2026, 10, 8, 12);

/** Матч до итога победы на заданных данных хранилища; часы идут от `T0`. */
function winFlow(init: Parameters<typeof memoryMatchStore>[1]) {
  let t = T0;
  const flow = createMatchFlow({ lesson, store: memoryMatchStore(matchRules, init), clock: () => (t += 100), seed: () => 7, live: false });
  flow.start();
  drive(flow, (s) => s.phase === 'break');
  flow.toSecondHalf();
  drive(flow, (s) => s.phase === 'result');
  return flow;
}
const summaryOfFlow = (flow: ReturnType<typeof winFlow>): MatchSummary | null => {
  const info = flow.view.value.result;
  return info ? flow.summary(resultModel(info, extras), dayOf) : null;
};

describe('матчдэй: снимок «до матча» в потоке (design §7.1)', () => {
  it('первый проход: firstPass и звёзды «до» нулевые, хотя итог уже записан в хранилище', () => {
    // Ловит: снимок, взятый после записи итога (wasPassed → true, firstPass пропал, пак не выдастся).
    const { flow, store } = jumpWith('win', lesson, false);
    const info = flow.view.value.result;
    expect(info).not.toBeNull();
    expect(store.read().lessons[lesson.id]?.best).toBeGreaterThan(0);
    const s = summaryOfFlow(flow);
    expect(s).toMatchObject({ lessonId: lesson.id, league: lesson.league, passed: true, firstPass: true, starsBefore: 0, firstMatchToday: true });
    expect(s!.starsAfter).toBeGreaterThan(0);
  });

  it('повтор в тот же день: нет firstPass и firstMatchToday, лучшие звёзды остаются', () => {
    // Ловит: второй пак за урок, «первый матч дня» на каждом матче, откат звёзд.
    const flow = winFlow({ lessons: { [lesson.id]: { best: 3, fails: 0 } }, played: { byLeague: {}, lastFinishedAt: T0 - 3_600_000 } });
    const s = summaryOfFlow(flow);
    expect(s).toMatchObject({ firstPass: false, firstMatchToday: false, starsBefore: 3, starsAfter: 3 });
  });

  it('до итога summary — null; время свистка — часы потока', () => {
    // Ловит: итог из пустоты, `at` = 0.
    const model = resultModel(winFlow({}).view.value.result!, extras);
    const fresh = createMatchFlow({ lesson, store: memoryMatchStore(matchRules), clock: () => T0, seed: () => 7, live: false });
    expect(fresh.summary(model, dayOf)).toBeNull();
    expect(summaryOfFlow(winFlow({}))!.at).toBeGreaterThan(T0);
  });

  it('итог — простой объект: проходит structuredClone слоя записи', () => {
    // Ловит: Proxy Vue в итоге (DataCloneError в слое записи).
    const s = summaryOfFlow(jumpWith('win', lesson, false).flow);
    expect(structuredClone(s)).toEqual(s);
  });
});

describe('матчдэй: ход цепочки (createMatchday)', () => {
  const sum = { firstPass: true } as MatchSummary;
  const def = (id: string, kind: StepKind, on = true): AppStep => ({
    id, kind, offer: () => (on ? { id, kind, route: `/${id}` } : null),
  });
  const run = (defs: AppStep[]) => {
    const went: unknown[] = [];
    return { day: createMatchday(defs, (to) => went.push(to)), went };
  };

  it('пустой реестр: «Дальше» ведёт сразу на карту', () => {
    // Ловит: зависание на итоге, когда шагов ещё нет (019 без 040).
    const { day, went } = run([]);
    day.start(sum);
    expect(went).toEqual([MAP_PATH]);
  });

  it('4 шага и 3 праздника: до карты ≤ 4, праздник один, остальные в очереди, потом карта', () => {
    // Ловит: цепочка длиннее четырёх, два праздника подряд, потеря непоказанного.
    const { day, went } = run([
      def('p', 'pack'), def('c1', 'celebration'), def('c2', 'celebration'), def('c3', 'celebration'), def('s', 'school'), def('d', 'dayEnd'),
    ]);
    day.start(sum);
    expect(went).toEqual(['/p']);
    for (const id of ['p', 'c1', 's', 'd']) day.done(id);
    expect(went).toEqual(['/p', '/c1', '/s', '/d', MAP_PATH]);
    expect(day.queued().map((o) => o.id)).toEqual(['c2', 'c3']);
  });

  it('шаг, не предложивший себя, пропущен; повторный done того же шага не перескакивает', () => {
    // Ловит: двойной щелчок «Дальше» шага, съедающий следующий шаг; предложение null в цепочке.
    const { day, went } = run([def('p', 'pack'), def('c', 'celebration', false), def('s', 'school')]);
    day.start(sum);
    day.done('p');
    day.done('p');
    expect(went).toEqual(['/p', '/s']);
    day.done('s');
    expect(went.at(-1)).toBe(MAP_PATH);
  });

  it('F5 посреди цепочки: плана нет, шаг закончился — карта', () => {
    // Ловит: шаг, после перезагрузки не знающий, куда идти.
    const { day, went } = run([def('p', 'pack')]);
    day.done('p');
    expect(went).toEqual([MAP_PATH]);
  });
});

describe('матчдэй: реестр шагов', () => {
  it('все шаги в реестре: src/app/*/matchdayStep.ts с диска = ключи сборки', () => {
    // Ловит: шаг подсистемы (022, 024, 040) лежит в app/<подсистема>/matchdayStep.ts, а сборка его не видит — цепочка без шага.
    const root = join(__dirname, '../src/app');
    const onDisk = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .filter((d) => readdirSync(join(root, d.name)).includes('matchdayStep.ts'))
      .map((d) => d.name)
      .sort();
    const inRegistry = Object.keys(stepModules).map((k) => /^\.\.\/([^/]+)\/matchdayStep\.ts$/.exec(k)?.[1] ?? k).sort();
    expect(inRegistry).toEqual(onDisk);
    expect(steps.map((s) => s.id).length).toBe(new Set(steps.map((s) => s.id)).size);
  });

  it('сборка: шаги файлов сводятся; повтор id и файл без steps — ошибка', () => {
    // Ловит: тихую подмену шага вторым с тем же id, молчаливый пропуск пустого файла.
    const a: AppStep = { id: 'a', kind: 'pack', offer: () => null };
    const b: AppStep = { id: 'b', kind: 'school', offer: () => null };
    expect(collectSteps({ '../x/matchdayStep.ts': { steps: [a] }, '../y/matchdayStep.ts': { steps: [b] } }).map((s) => s.id)).toEqual(['a', 'b']);
    expect(() => collectSteps({ '../x/matchdayStep.ts': { steps: [a] }, '../y/matchdayStep.ts': { steps: [a] } })).toThrow(/duplicate.*a/);
    expect(() => collectSteps({ '../x/matchdayStep.ts': {} })).toThrow(/no exported steps/);
  });
});
