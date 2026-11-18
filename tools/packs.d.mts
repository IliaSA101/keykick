import type { Plugin } from 'vite';

type Files = { lessons: string; text: Record<string, string> };

export interface PackListing {
  id: string;
  rev: number;
  access: string;
  files: Files;
  /** Папка пакета (читается из дерева, в самом pack.json поля нет). */
  dir: string;
}
export const FIRST_SCREEN_LIMIT: number;
export function selectPacks<T extends { access: string }>(manifests: T[], edition: string | undefined): { picked: T[]; skipped: T[] };
export function readManifests(packsDir: string): PackListing[];
export function packFiles(manifest: { files: Files }): string[];
export function packIndex(picked: Array<{ id: string; rev: number }>): Record<string, number>;
export function findClosedInDist(distDir: string, closedIds: string[]): string[];
export function firstScreenBytes(distDir: string): { total: number; files: Array<{ file: string; bytes: number }> };
export default function packsPlugin(opts?: { edition?: string | undefined; packsDir?: string; log?: (line: string) => void }): Plugin;
