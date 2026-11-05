/**
 * Тексты решающей по правилам лиги урока (спека 008): во дворе — «Решающая атака» и прежние слова,
 * с района — «Решающая серия». Шаблоны и числа — в i18n/ru ({n}, {i}, {m}); здесь только подстановка,
 * чтобы компоненты не склеивали числа сами. Без Vue — проверяется в tests/guards.test.ts.
 */
import type { LeagueRules } from '../engine/match';
import { ru } from '../i18n/ru';

/** Слова решающей: одна атака или серия. */
function words(rules: LeagueRules) {
  return rules.series > 1 ? ru.match.decisive.series : ru.match.decisive.attack;
}

/** Подстановка чисел в шаблон: {n} — запас ошибок и прочие по имени. */
function fill(template: string, values: Readonly<Record<string, number>>): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all));
}

/** Большая надпись перед первой атакой серии. */
export function decisiveBanner(rules: LeagueRules): string {
  return words(rules).banner;
}

/** Подпись над полем: «Решающая атака» или «Решающая серия · 1 из 2»; no — атака серии с 1. */
export function decisiveCaption(rules: LeagueRules, no: number): string {
  return fill(words(rules).caption, { i: no, m: rules.series });
}

/** Третье правило вступления; в кубке — про ничью. */
export function decisiveRule(rules: LeagueRules, cup: boolean): { title: string; text: string } {
  const rule = words(rules).rule;
  const cupText = rules.series > 1 ? ru.cup.decisiveRule.series : ru.cup.decisiveRule.attack;
  return { title: rule.title, text: fill(cup ? cupText : rule.text, { n: rules.maxErrors }) };
}

/** Начало строки итога: «В решающей серии». */
export function decisiveResult(rules: LeagueRules): string {
  return words(rules).result;
}

/** Почему звёзд столько — с запасом лиги. */
export function starsWhy(rules: LeagueRules): string {
  return fill(words(rules).starsWhy, { n: rules.maxErrors });
}

/** Урок не пройден: «Нужно не больше 3. …». */
export function tryAgain(rules: LeagueRules): string {
  return fill(ru.match.tryAgain, { n: rules.maxErrors });
}
