/**
 * Пробный английский из одного блока: проверяет, что второй язык проходит по форме `Messages`.
 * В сборку не идёт (060-Р9): лежит в tests/, а не в src/.
 */
import type { Messages } from '../../../src/i18n/ru';

export const enShell = {
  building: 'Game under construction',
  buildingHint: 'The new Keyboard League will be here soon.',
} satisfies Messages['shell'];
