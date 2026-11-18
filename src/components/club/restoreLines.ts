/**
 * Строки окон «Клуб пропал?» (Э6.75–82) и «Что изменится» страницы родителя (Э6.54): одни слова и одна сборка на оба экрана (063-Р46).
 * Данные приходят из движка (`restoreFacts`, `restoreFile`), здесь — только текст.
 */
import type { Fact, RestoreFile } from '../../engine/club/start';
import { ru } from '../../i18n/ru';

/** Факты игрока: «Урок 14 · Монеты 204 · Играл 08.11.2026»; фактов нет — пустая строка. */
export function factLine(facts: readonly Fact[]): string {
  const t = ru.start.lost;
  return facts.map((f) => (f.kind === 'lesson' ? `${t.lesson} ${f.n}` : f.kind === 'coins' ? `${t.coins} ${f.n}` : `${t.played} ${f.date}`)).join(' · ');
}

/** «Файл от 08.11.2026 · версия игры 2.0»; части, которых в файле нет, пропускаются. */
export function fileLine(file: RestoreFile): string {
  const t = ru.start.lost;
  return [file.date === null ? '' : `${t.fileFrom} ${file.date}`, file.version === null ? '' : `${t.version} ${file.version}`].filter((x) => x !== '').join(' · ');
}
