/**
 * Первый импорт main.ts: в dev-сборке применяет фикстуру `?seed=` до загрузки остального приложения.
 * В выпуске `import.meta.env.DEV` — false, ветка и seed.ts в сборку не попадают (проверка — dist без «seed»).
 */
import { applySeed } from './seed';

if (import.meta.env.DEV) applySeed(globalThis.location.search);

// `#/dev/crash?throw=boot` — бросок при оценке модуля (после installCrash): проверка, что загрузочный сбой попадает на экран.
if (import.meta.env.DEV && globalThis.location.hash.includes('throw=boot')) throw new Error('dev crash: boot');
