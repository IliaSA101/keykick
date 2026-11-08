/**
 * Общие типы слоя сохранения (спека 014-Т3): хранилище, параметры, состояние и зависимости частей слоя.
 * Отдельный файл — чтобы `space`, `load` и `store` не ссылались друг на друга по кругу.
 */
import type { SaveContext, SectionDef } from '../../engine/save/section';
import type { TextRead } from '../storage';

/** Хранилище текста: ключи — полные, с префиксом. */
export interface TextIo {
  read(key: string): TextRead;
  write(key: string, text: string): boolean;
  remove(key: string): boolean;
  /** Все ключи, начинающиеся с prefix. */
  keys(prefix: string): string[];
  /** Другая вкладка поменяла ключ (null — всё хранилище). */
  onChange?(fn: (key: string | null) => void): void;
}

export interface StoreOptions {
  prefix: string;
  /** 'release' | 'next': на `next` копии имеют потолок. */
  channel: string;
  storage: TextIo;
  /** Реестр разделов: полный — `app/save/registry.ts`, тест передаёт свой. */
  sections: readonly SectionDef[];
  now(): number;
  /** Сегодня, `YYYY-MM-DD`. */
  today(): string;
  /** APP_VERSION программы: пишется в конверт. */
  app: string;
  ctx: SaveContext;
  /** Игрок есть в списке (свежем): пропавший ключ удалённого игрока не воскрешается. */
  hasPlayer?(id: string): boolean;
}

export interface StoreStatus {
  /** Сохранение новее программы: ничего не пишем (design §5). */
  readOnly: boolean;
  /** Копия или запись не влезла даже после освобождения места: игра идёт из памяти. */
  storageFull: boolean;
  /** Цепочка миграций бросила: сохранение не тронуто, игра не должна монтироваться. */
  migrateFailed: boolean;
  /** Что нашли при загрузке игрока: битое (ушло в карантин) или чистый старт при наличии снимков. */
  found: Record<string, 'broken' | 'fresh-with-snaps'>;
}

export interface StoreEvent {
  t: number;
  kind: 'storage';
  text: string;
}

/** Разделы конверта по именам (разделы v2, 018). */
export type Sections = Record<string, unknown>;

/** Что слой помнит об игроке: `rev` лежащего конверта на момент чтения/записи и данные в памяти. */
export interface Known {
  rev: number;
  save: Sections;
}

/** Результат чтения ключа игрока (envelope). */
export interface ReadOk {
  kind: 'ok';
  save: Sections;
  rev: number;
  sections: Record<string, unknown>;
  fresh: boolean;
  /** Копию и основной ключ записал этот самый вызов (карантин, обёртка, миграция): память новее лежащего. */
  wrote: boolean;
}

export type Read =
  | ReadOk
  | { kind: 'newer' }
  | { kind: 'blocked' }
  /** Копия «до» не легла: основной ключ не тронут и не пишется; игра идёт из памяти (`save`). */
  | { kind: 'held'; save: Sections };

/** Общие зависимости частей слоя: состояние живёт в фабрике `createSaveStore`, части получают его по ссылке. */
export interface Deps {
  opts: StoreOptions;
  io: TextIo;
  mainKey: (id: string) => string;
  known: Map<string, Known>;
  blocked: Set<string>;
  status: StoreStatus;
  log: (text: string) => void;
  emptySave: () => Sections;
  parseAll: (raw: Sections) => Sections;
  names: () => string[];
  readOf: (key: string) => string | null;
  writeFree: (key: string, text: string) => boolean;
  /** Копия раньше основного ключа (Б1); true — основной ключ записан. */
  copyThenMain: (copyName: string, copyText: string, key: string, mainText: string) => boolean;
}
