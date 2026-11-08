/**
 * Реестр разделов сохранения (спека 018 design §1): все `engine/<подсистема>/save.ts`.
 * Подсистема добавляет раздел файлом — строки здесь не нужны (маска, как у курса — `app/course/load.ts`).
 */
import type { SectionDef } from '../../engine/save/section';

const files = import.meta.glob<{ section?: SectionDef }>('../../engine/*/save.ts', { eager: true });

/** Разделы, найденные по маске: файл без `section` — бросок при загрузке модуля (красные тесты `saveSections`/`saveGolden`), а не молчание. */
const found: SectionDef[] = Object.entries(files).map(([path, mod]) => {
  if (!mod.section) throw new Error(`${path}: no section export (defineSection)`);
  return mod.section;
});

export const registry: readonly SectionDef[] = found;
