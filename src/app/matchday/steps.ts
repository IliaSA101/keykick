/**
 * Реестр шагов матчдэя (спека 019, design §7, В4, 019-Р10): шаги дают подсистемы файлами
 * `src/app/<подсистема>/matchdayStep.ts` (`export const steps: StepDef<RouteLocationRaw>[]`). Реестр собирает
 * `import.meta.glob`, а не регистрация при загрузке модуля: ленивый экран итога не знал бы о шагах, которые не успели загрузиться.
 * Шагов-наполнения пока нет (пак, праздник, школа, конец дня — 022, 024, 040): реестр пуст, и после итога сразу карта.
 */
import type { RouteLocationRaw } from 'vue-router';
import type { StepDef } from '../../engine/matchday/queue';

export type AppStep = StepDef<RouteLocationRaw>;
type StepModule = { steps?: AppStep[] };

/** Файлы подсистем: путь → модуль. */
export const stepModules: Record<string, StepModule> = import.meta.glob<StepModule>('../*/matchdayStep.ts', { eager: true });

/**
 * Свести шаги всех файлов в один список. Файл без `steps` и повтор id шага — ошибка при сборке реестра,
 * а не тихая подмена (тест «все шаги в реестре» ловит это до выкладки).
 */
export function collectSteps(mods: Record<string, StepModule>): AppStep[] {
  const all: AppStep[] = [];
  const seen = new Set<string>();
  for (const [path, mod] of Object.entries(mods)) {
    if (!Array.isArray(mod.steps)) throw new Error(`${path}: no exported steps`);
    for (const def of mod.steps) {
      if (seen.has(def.id)) throw new Error(`${path}: duplicate matchday step ${def.id}`);
      seen.add(def.id);
      all.push(def);
    }
  }
  return all;
}

export const steps: AppStep[] = collectSteps(stepModules);
