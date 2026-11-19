/**
 * Связка догрузки с браузером (067 Т23): `new Image()` с низким приоритетом и адресом `BASE_URL` + файл, молчание на стенде
 * кадров `/dev/`, игрок не открылся — без ошибки. `Image` подделан, сеанс и пакет — подставлены; модуль берётся заново на каждый тест
 * (очередь и «уже запрошено» живут в модуле).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { artFiles, artUrl } from '../../src/art/assets';

const order = Array.from({ length: 32 }, (_, i) => `ru.yard.l${i + 1}`);
const done = Object.fromEntries(order.slice(0, 9).map((id) => [id, { stars: 3, best: 0, tries: 1, done: '2026-11-10' }]));
const player = { value: { kind: 'ok', pid: 'p1', env: { sections: { 'course:ru': { data: { current: order[9], lessons: done, archive: {}, leaguesDone: {} } }, shop: { data: { bought: [] } } } } } as unknown };

vi.mock('../../src/app/save/session', () => ({ useSession: () => ({ player }) }));
vi.mock('../../src/app/packs/usePack', () => ({ lessonOrder: () => Promise.resolve(order) }));

interface Fake { src: string; fetchPriority?: string; onload?: () => void; onerror?: () => void }
let images: Fake[] = [];
const okPlayer = player.value;

beforeEach(() => {
  images = [];
  player.value = okPlayer;
  vi.resetModules();
  vi.stubGlobal('Image', class {
    fetchPriority?: string;
    onload?: () => void;
    onerror?: () => void;
    private url = '';
    constructor() { images.push(this); }
    get src(): string { return this.url; }
    set src(v: string) { this.url = v; queueMicrotask(() => this.onload?.()); }
  });
  vi.stubGlobal('requestIdleCallback', (run: () => void) => run());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('../../src/app/save/session');
});

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 0));
};

describe('догрузка и браузер', () => {
  it('К23-5 приоритет: каждая картинка очереди — fetchPriority low (не мешает экрану)', async () => {
    const { onRoute } = await import('../../src/app/preload/browser');
    await onRoute('home', {}, '/home');
    await flush();
    expect(images.length).toBeGreaterThan(0);
    expect(images.map((i) => i.fetchPriority)).toEqual(images.map(() => 'low'));
  });

  it('К23-5 адрес: src = BASE_URL + файл, как у artUrl; графика самого Дома не грузится, соседи — да', async () => {
    const { onRoute } = await import('../../src/app/preload/browser');
    await onRoute('home', {}, '/home');
    await flush();
    const srcs = images.map((i) => i.src);
    expect(srcs).toContain(artUrl('albumMuseumIn'));
    expect(srcs).toContain(import.meta.env.BASE_URL + 'art/map/bus-34.webp');
    expect(srcs.every((s) => s.startsWith(import.meta.env.BASE_URL))).toBe(true);
    expect(srcs).not.toContain(artUrl('baseSashaStand')); // Чеканка — сосед Базы: глубина 1, с Дома её нет
    expect(artFiles.albumMuseumIn).toBeTruthy();
  });

  it('К23-5 стенд кадров /dev/ — загрузок нет', async () => {
    const { onRoute } = await import('../../src/app/preload/browser');
    await onRoute('home', {}, '/dev/frame/home');
    await flush();
    expect(images).toEqual([]);
  });

  it('К23-5 игрок не открылся (kind bad): без ошибки; урок неизвестен — Дом как на первом уроке', async () => {
    player.value = { kind: 'bad', pid: 'p1' };
    const { onRoute } = await import('../../src/app/preload/browser');
    await expect(onRoute('home', {}, '/home')).resolves.toBeUndefined();
    await flush();
    expect(images.length).toBeGreaterThan(0);
  });
});
