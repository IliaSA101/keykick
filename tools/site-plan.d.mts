export interface SiteFile {
  root: string;
  versions: Record<string, string>;
}
export interface BuildStep {
  /** next | vN | root */
  name: string;
  /** Метка git; null — голова (рабочая копия). */
  ref: string | null;
  base: string;
  /** Папка внутри dist/; '' — корень. */
  dir: string;
  /** Значение VITE_KK_CHANNEL; null — переменная не передаётся. */
  channel: 'release' | 'next' | null;
}
export function sitePlan(site: SiteFile): BuildStep[];
