export interface TextNode {
  text: string;
  /** Итоговый размер шрифта на экране, px. */
  px: number;
  where: string;
}
export interface DotNode {
  /** Меньшая сторона рамки точки, px. */
  px: number;
  where: string;
}
export interface Scan {
  scale: number;
  text: TextNode[];
  dots: DotNode[];
}
export interface Small {
  text: TextNode[];
  dots: DotNode[];
}
export interface Limits {
  minText?: number;
  minDot?: number;
}

export const MIN_TEXT: number;
export const MIN_DOT: number;
export const DOT_SELECTOR: string;
export function collectScreen(dotSelector: string): Scan;
export function findSmall(scan: Scan, limits?: Limits): Small;
export function formatSmall(code: string, small: Small, opts?: Limits & { seen?: Scan | null }): string;
