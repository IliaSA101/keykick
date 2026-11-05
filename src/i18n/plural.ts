/**
 * Склонение по числу: «1 ошибка», «3 ошибки», «5 ошибок». Правила — у браузера (Intl.PluralRules).
 */
export interface PluralForms {
  one: string;
  few: string;
  many: string;
}

const rules = new Intl.PluralRules('ru-RU');

export function plural(n: number, forms: PluralForms): string {
  const kind = rules.select(n);
  if (kind === 'one') return forms.one;
  if (kind === 'few') return forms.few;
  return forms.many;
}
