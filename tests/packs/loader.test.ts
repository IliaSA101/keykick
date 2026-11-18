/**
 * Загрузчик пакетов (060-Т4б, К11): сеть подменена. У каждого теста строка «Ловит:» — какую поломку он видит.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { SHELL_API, clearPackCache, loadPack, type FetchLike, type FetchResponse, type LoadResult } from '../../src/app/packs/loader';
import type { Pack } from '../../src/content/schema/pack';
import { createPackState, shellOld } from '../../src/app/packs/usePack';

const BASE = '/keykick/next/';
const dir = (name: string) => new URL(`../../src/content/packs/${name}/`, import.meta.url);
const readJson = (name: string, file: string): unknown => JSON.parse(readFileSync(new URL(file, dir(name)), 'utf8'));

/** Сервер «в памяти»: адрес → тело; чего нет — 404. Считает обращения. */
function server(files: Record<string, unknown>, override: Record<string, () => FetchResponse | Promise<FetchResponse>> = {}) {
  const calls: string[] = [];
  const fetch: FetchLike = async (url) => {
    calls.push(url);
    const o = override[url];
    if (o) return o();
    if (!(url in files)) return { ok: false, status: 404, json: () => Promise.reject(new Error('no body')) };
    return { ok: true, status: 200, json: () => Promise.resolve(structuredClone(files[url])) };
  };
  return { fetch, calls };
}

/** Файлы настоящего пакета ru.yard по адресам загрузчика. */
function yardFiles(patch: (m: Record<string, unknown>) => void = () => undefined): Record<string, unknown> {
  const manifest = readJson('ru.yard', 'pack.json') as Record<string, unknown>;
  patch(manifest);
  const d = `${BASE}packs/ru.yard/${String(manifest.rev)}/`;
  return {
    [`${BASE}packs/index.json`]: { 'ru.yard': manifest.rev },
    [`${d}pack.json`]: manifest,
    [`${d}lessons.json`]: readJson('ru.yard', 'lessons.json'),
    [`${d}text.ru.json`]: readJson('ru.yard', 'text.ru.json'),
  };
}

const opts = (fetch: FetchLike, shellApi = SHELL_API) => ({ base: BASE, fetch, shellApi });

beforeEach(() => clearPackCache());

describe('loadPack: исходы (К11)', () => {
  it('К11: ok — пакет целиком, адрес от base и ревизии из указателя', async () => {
    // Ловит: загрузчик берёт адрес без base (на /keykick/next/ файлы не находятся) или не дочитывает текст/уроки.
    const s = server(yardFiles());
    const r = await loadPack('ru.yard', opts(s.fetch));
    expect(r).toMatchObject({ ok: true });
    if (!('ok' in r)) return;
    expect(r.pack.manifest.id).toBe('ru.yard');
    expect(Object.keys(r.pack.lessons.lessons).length).toBe(r.pack.lessons.order.length);
    expect(Object.keys(r.pack.text)).toEqual(['ru']);
    expect(s.calls).toEqual([
      `${BASE}packs/index.json`,
      `${BASE}packs/ru.yard/1/pack.json`,
      `${BASE}packs/ru.yard/1/lessons.json`,
      `${BASE}packs/ru.yard/1/text.ru.json`,
    ]);
  });

  it('К11: offline — сеть оборвалась или сервер 5xx; сбой не запоминается', async () => {
    // Ловит: оборванная связь становится «bad» или исключением, либо первый сбой застревает в кэше до перезагрузки.
    const files = yardFiles();
    let up = false;
    const good = server(files);
    const fetch: FetchLike = (url) => (up ? good.fetch(url) : Promise.reject(new TypeError('Failed to fetch')));
    expect(await loadPack('ru.yard', opts(fetch))).toEqual({ err: 'offline' });
    const s5 = server(files, { [`${BASE}packs/index.json`]: () => ({ ok: false, status: 503, json: () => Promise.reject(new Error('x')) }) });
    expect(await loadPack('ru.yard', opts(s5.fetch))).toEqual({ err: 'offline' });
    up = true;
    expect(await loadPack('ru.yard', opts(fetch))).toMatchObject({ ok: true });
  });

  it('К11: forbidden — 403 и 404 на файле, и id нет в указателе (закрытый в открытой сборке)', async () => {
    // Ловит: закрытый пакет без доступа выглядит как «нет связи» (ребёнку советуют проверить интернет) или как битый.
    const files = yardFiles();
    const manifestUrl = `${BASE}packs/ru.yard/1/pack.json`;
    const s403 = server(files, { [manifestUrl]: () => ({ ok: false, status: 403, json: () => Promise.reject(new Error('x')) }) });
    expect(await loadPack('ru.yard', opts(s403.fetch))).toEqual({ err: 'forbidden' });
    clearPackCache();
    const noFile = server(Object.fromEntries(Object.entries(files).filter(([u]) => u !== manifestUrl)));
    expect(await loadPack('ru.yard', opts(noFile.fetch))).toEqual({ err: 'forbidden' });
    clearPackCache();
    const s = server(files);
    expect(await loadPack('x.closed', opts(s.fetch))).toEqual({ err: 'forbidden' });
  });

  it('К11: bad — не JSON, манифест не по схеме, чужой id или ревизия, связи пакета нарушены', async () => {
    // Ловит: битый пакет принят (движок упадёт на уроке посреди игры) или проверка связей между файлами пропущена.
    const notJson = server(yardFiles(), { [`${BASE}packs/ru.yard/1/lessons.json`]: () => ({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('x')) }) });
    expect(await loadPack('ru.yard', opts(notJson.fetch))).toEqual({ err: 'bad' });
    clearPackCache();
    const noShell = server(yardFiles((m) => delete m.shellApi));
    expect(await loadPack('ru.yard', opts(noShell.fetch))).toEqual({ err: 'bad' });
    clearPackCache();
    const stale = yardFiles();
    (stale[`${BASE}packs/ru.yard/1/pack.json`] as { rev: number }).rev = 2; // по адресу ревизии 1 лежит манифест ревизии 2
    expect(await loadPack('ru.yard', opts(server(stale).fetch))).toEqual({ err: 'bad' });
    clearPackCache();
    const alien = server(yardFiles((m) => ((m.id = 'ru.moscow'), (m.league = 'moscow'))));
    expect(await loadPack('ru.yard', opts(alien.fetch))).toEqual({ err: 'bad' });
    clearPackCache();
    const files = yardFiles();
    const text = files[`${BASE}packs/ru.yard/1/text.ru.json`] as { lessons: Record<string, unknown> };
    delete text.lessons['ru.yard.ao'];
    expect(await loadPack('ru.yard', opts(server(files).fetch))).toEqual({ err: 'bad' });
    clearPackCache();
    expect(await loadPack('ru.yard', opts(server({ [`${BASE}packs/index.json`]: ['ru.yard'] }).fetch))).toEqual({ err: 'bad' });
  });

  it('К11: shell-old — пакету нужна оболочка новее; остальные файлы не качаются', async () => {
    // Ловит: старая оболочка берёт пакет нового формата (падение на уроке) либо качает его весь перед отказом.
    const s = server(yardFiles((m) => (m.shellApi = SHELL_API + 1)));
    expect(await loadPack('ru.yard', opts(s.fetch))).toEqual({ err: 'shell-old' });
    expect(s.calls.some((u) => u.endsWith('lessons.json'))).toBe(false);
    clearPackCache();
    const ok = server(yardFiles());
    expect(await loadPack('ru.yard', opts(ok.fetch, 0))).toEqual({ err: 'shell-old' });
  });
});

describe('loadPack: кэш сеанса (К11)', () => {
  it('К11: повторный вход и два входа разом — одна загрузка', async () => {
    // Ловит: пакет качается заново при каждом входе в лигу или два одновременных входа дают двойную нагрузку.
    const s = server(yardFiles());
    const [a, b] = await Promise.all([loadPack('ru.yard', opts(s.fetch)), loadPack('ru.yard', opts(s.fetch))]);
    expect(a).toEqual(b);
    const n = s.calls.length;
    expect(n).toBe(4);
    await loadPack('ru.yard', opts(s.fetch));
    expect(s.calls.length).toBe(n);
  });

  it('К11: из кэша пакет новее оболочки тоже не отдаётся', async () => {
    // Ловит: кэш обходит проверку совместимости — оболочку понизили (откат версии), а пакет из памяти отдан.
    const s = server(yardFiles());
    expect(await loadPack('ru.yard', opts(s.fetch, 5))).toMatchObject({ ok: true });
    const m = (await loadPack('ru.yard', opts(s.fetch, 5))) as { ok: true; pack: { manifest: { shellApi: number } } };
    expect(m.pack.manifest.shellApi).toBe(1);
    expect(await loadPack('ru.yard', opts(s.fetch, 0))).toEqual({ err: 'shell-old' });
  });
});

describe('usePack: состояние для экрана (К9)', () => {
  it('К9: loading → ok с пакетом; «Ещё раз» после offline снова грузит и доходит до ok', async () => {
    // Ловит: экран навсегда в loading/offline — кнопка «Ещё раз» не перезапускает загрузку или состояние не доходит до ok.
    let online = false;
    const files = yardFiles();
    const s = server(files);
    const fetch: FetchLike = (url) => (online ? s.fetch(url) : Promise.reject(new Error('offline')));
    const h = createPackState('ru.yard', (id) => loadPack(id, opts(fetch)));
    expect(h.state.value).toBe('loading');
    await h.retry();
    expect(h.state.value).toBe('offline');
    expect(h.pack.value).toBeUndefined();
    online = true;
    const again = h.retry();
    expect(h.state.value).toBe('loading');
    await again;
    expect(h.state.value).toBe('ok');
    expect(h.pack.value?.manifest.id).toBe('ru.yard');
  });

  it('К9: forbidden / bad / shell-old доходят до экрана как есть; исключение загрузчика — bad, не падение', async () => {
    // Ловит: ошибка пакета схлопывается в одно состояние (во Дворе forbidden — ошибка сборки, а не «нет связи») или бросает наружу.
    const forbidden = createPackState('ru.nope', (id) => loadPack(id, opts(server(yardFiles()).fetch)));
    await forbidden.retry();
    expect(forbidden.state.value).toBe('forbidden');
    const old = createPackState('ru.yard', (id) => loadPack(id, opts(server(yardFiles()).fetch, 0)));
    await old.retry();
    expect(old.state.value).toBe('shell-old');
    const boom = createPackState('x', () => Promise.reject(new Error('x')));
    await boom.retry();
    expect(boom.state.value).toBe('bad');
  });

  it('К14 (063-Р58): shell-old поднимает общий признак `shellOld` (окно «Игра обновилась» в каркасе); offline и bad — нет', async () => {
    // Ловит: каркас не узнаёт, что оболочка старше пакета (окно не покажется), или показывает его при обрыве связи.
    shellOld.value = false;
    await createPackState('ru.yard', (id) => loadPack(id, opts(server(yardFiles()).fetch, 0))).retry();
    expect(shellOld.value).toBe(true);
    shellOld.value = false;
    await createPackState('x', () => Promise.resolve({ err: 'offline' })).retry();
    await createPackState('y', () => Promise.reject(new Error('y'))).retry();
    expect(shellOld.value).toBe(false);
  });

  it('К9: ответ устаревшей попытки не затирает новую (быстрые «Ещё раз»)', async () => {
    // Ловит: медленный первый ответ приходит после второго и возвращает экран в старое состояние.
    const resolvers: ((r: LoadResult) => void)[] = [];
    const h = createPackState('x', () => new Promise((res) => resolvers.push(res)));
    const second = h.retry();
    resolvers[1]!({ err: 'offline' });
    await second;
    resolvers[0]!({ ok: true, pack: {} as Pack });
    await Promise.resolve();
    expect(h.state.value).toBe('offline');
  });
});
