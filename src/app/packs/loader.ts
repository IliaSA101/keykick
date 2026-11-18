/**
 * Загрузчик пакетов лиг (060 §5, 059-Р1 а, Р10): пакет целиком за один заход, по сети, `fetch` внедряется
 * (тест без сети, 059 С-5). Кэш — в памяти на сеанс. Ошибки — значением, не исключением: экран решает, что показать.
 * Единственный адаптер сети для пакетов: `fetch(` вне `src/app/packs/` стражем запрещён.
 */
import { checkManifest, checkPack, fits } from '../../engine/packs/manifest';
import type { Pack, PackLessons, PackManifest, PackText } from '../../content/schema/pack';

/** Версия оболочки, которую умеет эта сборка (060-Р5); пакет с большим `shellApi` не загружается. */
export const SHELL_API = 1;

export type LoadErr = 'offline' | 'forbidden' | 'bad' | 'shell-old';
export type LoadResult = { ok: true; pack: Pack } | { err: LoadErr };

/** То, что загрузчику нужно от ответа сети; настоящий `Response` подходит. */
export interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}
export type FetchLike = (url: string) => Promise<FetchResponse>;

export interface LoadOptions {
  /** `import.meta.env.BASE_URL`: `/keykick/next/` и др., с «/» на конце. */
  base: string;
  fetch: FetchLike;
  shellApi: number;
}

/** Сбой загрузки одного файла; наружу не выходит — `loadPack` превращает в `LoadErr`. */
class Fail extends Error {
  readonly err: LoadErr;
  constructor(err: LoadErr) {
    super(err);
    this.err = err;
  }
}

/** Кэш сеанса: успешные пакеты и указатель ревизий; сбои не кэшируются (связь вернулась — следующий вход пробует снова). */
const packs = new Map<string, Promise<Pack>>();
const indexes = new Map<string, Promise<Record<string, number>>>();

/** Сбросить кэш сеанса (тесты; в игре — только перезагрузка страницы). */
export function clearPackCache(): void {
  packs.clear();
  indexes.clear();
}

/** Один JSON по адресу: нет связи — offline; 401/403/404 — forbidden (закрытого нет в этой сборке или нет доступа); 5xx — offline; не JSON — bad. */
async function getJson(fetchFn: FetchLike, url: string): Promise<unknown> {
  let res: FetchResponse;
  try {
    res = await fetchFn(url);
  } catch {
    throw new Fail('offline');
  }
  if (res.status === 401 || res.status === 403 || res.status === 404) throw new Fail('forbidden');
  if (!res.ok) throw new Fail('offline');
  try {
    return await res.json();
  } catch {
    throw new Fail('bad');
  }
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Указатель `packs/index.json` — «id → ревизия»: адрес файла пакета содержит ревизию, а узнать её больше неоткуда (060-Р16). */
function loadIndex(opts: LoadOptions): Promise<Record<string, number>> {
  const url = `${opts.base}packs/index.json`;
  const hit = indexes.get(url);
  if (hit !== undefined) return hit;
  const p = getJson(opts.fetch, url).then((raw) => {
    if (!isRecord(raw)) throw new Fail('bad');
    const out: Record<string, number> = {};
    for (const [id, rev] of Object.entries(raw)) {
      if (typeof rev !== 'number' || !Number.isInteger(rev) || rev < 1) throw new Fail('bad');
      out[id] = rev;
    }
    return out;
  });
  indexes.set(url, p);
  p.catch(() => indexes.delete(url));
  return p;
}

async function fetchPack(id: string, opts: LoadOptions): Promise<Pack> {
  const rev = (await loadIndex(opts))[id];
  if (rev === undefined) throw new Fail('forbidden'); // в этой сборке пакета нет (закрытый в открытой редакции)
  const dir = `${opts.base}packs/${id}/${rev}/`;
  const manifestRaw = await getJson(opts.fetch, `${dir}pack.json`);
  if (checkManifest(manifestRaw).length > 0) throw new Fail('bad');
  const manifest = manifestRaw as PackManifest;
  if (manifest.id !== id || manifest.rev !== rev) throw new Fail('bad');
  if (!fits(manifest, opts.shellApi)) throw new Fail('shell-old');
  const lessons = (await getJson(opts.fetch, dir + manifest.files.lessons)) as PackLessons;
  const text: Record<string, PackText> = {};
  for (const [lang, file] of Object.entries(manifest.files.text)) text[lang] = (await getJson(opts.fetch, dir + file)) as PackText;
  const pack: Pack = { manifest, lessons, text };
  if (checkPack(pack).length > 0) throw new Fail('bad');
  return pack;
}

/** Загрузить пакет лиги целиком. Повторный вход в сеансе — из памяти; пакет новее оболочки — `shell-old` и из памяти. */
export async function loadPack(id: string, opts: LoadOptions): Promise<LoadResult> {
  const key = `${opts.base}${id}`;
  let p = packs.get(key);
  if (p === undefined) {
    p = fetchPack(id, opts);
    packs.set(key, p);
    p.catch(() => packs.delete(key));
  }
  try {
    const pack = await p;
    return fits(pack.manifest, opts.shellApi) ? { ok: true, pack } : { err: 'shell-old' };
  } catch (e) {
    return { err: e instanceof Fail ? e.err : 'bad' };
  }
}
