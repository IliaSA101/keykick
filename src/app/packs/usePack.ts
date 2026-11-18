/**
 * Состояние загрузки пакета для экрана (063-Р5): `loading | ok | offline | forbidden | bad | shell-old`.
 * Сеть — только `window.fetch` через загрузчик (`loader.ts`, страж 059 §8), адрес — `import.meta.env.BASE_URL`.
 * `createPackState` — ядро без Vue-окружения и сети (загрузчик внедряется): тест гоняет его без браузера;
 * `usePack` — подключение к настоящей сети.
 */
import { shallowRef, type ShallowRef } from 'vue';
import type { Pack } from '../../content/schema/pack';
import { SHELL_API, loadPack, type LoadErr, type LoadResult } from './loader';

export type PackState = 'loading' | 'ok' | LoadErr;

/**
 * Оболочка старше пакета (`shell-old`): общий для вкладки признак — любой экран, увидевший такой пакет, поднимает его, окно «Игра обновилась»
 * в каркасе (063-Р58) его читает. Назад не опускается: исправляет только перезагрузка страницы.
 */
export const shellOld = shallowRef(false);

export interface PackHandle {
  state: ShallowRef<PackState>;
  /** Пакет — только при `state === 'ok'`. */
  pack: ShallowRef<Pack | undefined>;
  /** «Ещё раз»: загрузка заново; ответ устаревшей попытки отбрасывается. Не бросает. */
  retry(): Promise<void>;
}

export function createPackState(id: string, load: (id: string) => Promise<LoadResult>): PackHandle {
  const state = shallowRef<PackState>('loading');
  const pack = shallowRef<Pack | undefined>(undefined);
  let attempt = 0;

  async function retry(): Promise<void> {
    const mine = ++attempt;
    state.value = 'loading';
    pack.value = undefined;
    let res: LoadResult;
    try {
      res = await load(id);
    } catch {
      res = { err: 'bad' };
    }
    if (mine !== attempt) return; // новая попытка уже идёт
    if ('ok' in res) {
      pack.value = res.pack;
      state.value = 'ok';
    } else {
      state.value = res.err;
      if (res.err === 'shell-old') shellOld.value = true;
    }
  }

  void retry();
  return { state, pack, retry };
}

/** Пакет лиги `id` по сети одним заходом (без Vue-состояния): для экранов, которым пакет нужен разово (порядок уроков в «Что изменится»). */
export const fetchPack = (id: string): Promise<LoadResult> =>
  loadPack(id, { base: import.meta.env.BASE_URL, fetch: (url) => window.fetch(url), shellApi: SHELL_API });

/** Порядок уроков курса из пакета двора по сети; нет связи или пакет не открылся — пусто (строки «Урок N» просто нет, 063-Р46). */
export async function lessonOrder(): Promise<string[]> {
  return (await yardLessons()).order;
}

/** Порядок и названия уроков двора («Урок 17 из 32: Слова длиннее», Э6.47); не открылось — пусто. */
export async function yardLessons(): Promise<{ order: string[]; names: Record<string, string> }> {
  const got = await fetchPack('ru.yard').catch(() => ({ err: 'bad' as const }));
  if (!('ok' in got)) return { order: [], names: {} };
  const lessons = got.pack.text['ru']?.lessons ?? {};
  return { order: got.pack.lessons.order, names: Object.fromEntries(Object.entries(lessons).map(([id, l]) => [id, l.name])) };
}

/** Пакет лиги `id` по сети; вызывать один раз на экран. */
export function usePack(id: string): PackHandle {
  return createPackState(id, fetchPack);
}
