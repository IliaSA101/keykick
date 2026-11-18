/** Лист задачи (ЭБ.21): общие типы компонентов `components/paper/`. */

/** Полоса итога на листе после ответа. */
export interface PaperVerdict {
  /** `goal` — верно (зелёная полоса), `miss` — неверно (красная). */
  kind: 'goal' | 'miss';
  text: string;
  badge?: string;
  next: string;
}
