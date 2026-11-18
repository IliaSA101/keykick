/**
 * Склонение по числу: «1 ошибка», «3 ошибки», «5 ошибок» (ru), «1 error», «2 errors» (en).
 * Правила — у браузера (Intl.PluralRules), своих таблиц нет (060-Т10, С-26).
 * Формы: у языка нет нужной категории — берём `other`, затем `many`, затем `one`.
 */
export interface PluralForms {
  one: string;
  few?: string;
  many?: string;
  other?: string;
}

const rulesByLocale = new Map<string, Intl.PluralRules>();

function rulesOf(locale: string): Intl.PluralRules {
  let rules = rulesByLocale.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    rulesByLocale.set(locale, rules);
  }
  return rules;
}

/** `plural('ru', 5, forms)`; короткая запись `plural(5, forms)` — русский, как было до Т10. */
export function plural(locale: string, n: number, forms: PluralForms): string;
export function plural(n: number, forms: PluralForms): string;
export function plural(a: string | number, b: number | PluralForms, c?: PluralForms): string {
  const [locale, n, forms] = typeof a === 'string' ? [a, b as number, c as PluralForms] : ['ru', a, b as PluralForms];
  const kind = rulesOf(locale).select(n);
  if (kind === 'one') return forms.one;
  return forms[kind as 'few' | 'many' | 'other'] ?? forms.other ?? forms.many ?? forms.one;
}
