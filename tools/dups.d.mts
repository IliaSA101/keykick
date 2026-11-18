export interface StringEntry {
  key: string;
  value: string;
}
export interface I18nGroup {
  value: string;
  keys: string[];
}
export interface I18nMetric {
  /** Лишние повторы: ключей минус один по каждой группе одинаковых значений. */
  extra: number;
  /** Число ключей по значению. */
  values: Record<string, number>;
}
export interface Clone {
  scope: 'src' | 'tools';
  a: { file: string; start: number; end: number };
  b: { file: string; start: number; end: number };
  lines: number;
  tokens: number;
  pair: string;
}
export interface ScopeMetric {
  clones: number;
  lines: number;
  pairs: Record<string, number>;
}
export interface JscpdMetric {
  src: ScopeMetric;
  tools: ScopeMetric;
}
export interface Current {
  jscpd: JscpdMetric;
  i18n: I18nMetric;
  clones: Clone[];
  groups: I18nGroup[];
}
export interface Base {
  jscpd?: Partial<JscpdMetric>;
  i18n?: Partial<I18nMetric>;
}
export interface Verdict {
  grew: { label: string; text: string; places: string[] }[];
  lower: { label: string; text: string }[];
}
export function flattenStrings(value: unknown, prefix?: string): StringEntry[];
export function hasWords(text: string): boolean;
export function validateAllow(allow: unknown): string[];
export function findI18nDuplicates(entries: StringEntry[], allowed?: string[]): I18nGroup[];
export function i18nMetric(groups: I18nGroup[]): I18nMetric;
export function loadI18nEntries(dir: string): Promise<StringEntry[]>;
export function parseClones(report: unknown, root: string): Clone[];
export function jscpdMetric(clones: Clone[]): JscpdMetric;
export function compareToBase(current: Current, base: Base): Verdict;
export function makeBase(current: Current): Base;
export function largestClones(clones: Clone[], n?: number): { scope: string; text: string; tokens: number }[];
