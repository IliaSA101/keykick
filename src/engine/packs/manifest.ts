/**
 * Манифест пакета и совместимость с оболочкой (060 §5, 060-Р5). Чистые функции: пакет приходит снаружи
 * (загрузчик или тест), ничего не читается и не пишется.
 */
import { check, checkLessons, checkText } from '../../content/schema/pack';
import type { Pack, PackManifest } from '../../content/schema/pack';

/** Проверка `pack.json`: пусто — годен. */
export const checkManifest: (x: unknown) => string[] = check;

/**
 * Годится ли пакет оболочке: `shellApi` пакета — наименьшая версия оболочки, которой он по силам (целое, 060-Р5);
 * оболочка не старше — годен. Не целое или не по порядку — не годен (манифест такой `checkManifest` не пропустит).
 */
export function fits(pack: Pick<PackManifest, 'shellApi'>, shellApi: number): boolean {
  return Number.isInteger(pack.shellApi) && Number.isInteger(shellApi) && pack.shellApi >= 1 && pack.shellApi <= shellApi;
}

/** Пакет целиком: манифест, файл уроков и тексты каждого языка из манифеста — формы и связи. Пусто — годен. */
export function checkPack(pack: Pack): string[] {
  const errs = checkManifest(pack.manifest).map((e) => `manifest: ${e}`);
  if (errs.length > 0) return errs;
  errs.push(...checkLessons(pack.lessons, pack.manifest.id).map((e) => `lessons: ${e}`));
  const stages = Array.isArray(pack.lessons.stages) ? pack.lessons.stages.map((s) => s.n) : [];
  for (const lang of Object.keys(pack.manifest.files.text)) {
    const text = pack.text[lang];
    if (text === undefined) errs.push(`text.${lang}: no text file`);
    else errs.push(...checkText(text, Array.isArray(pack.lessons.order) ? pack.lessons.order : [], stages).map((e) => `text.${lang}: ${e}`));
  }
  return errs;
}
