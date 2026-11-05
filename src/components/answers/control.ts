/**
 * Договор компонента ответа с листом задачи: лист спрашивает, что введено, и возвращает
 * фокус в поле после подсказки. Проверяет ответ движок (src/engine/answers.ts), не компонент.
 */
import type { AnswerInput } from '../../engine/answers';

export interface AnswerControl {
  read(): AnswerInput;
  focus(): void;
}

/** Общие свойства компонентов ответа. invalid — показана подсказка формата или неполноты. */
export interface AnswerProps {
  idBase: string;
  disabled: boolean;
  invalid: boolean;
  describedby: string;
}

/** Пустое поле или поле с ошибкой — его подсвечиваем после подсказки. */
export const isBlank = (s: string): boolean => s.trim() === '';
