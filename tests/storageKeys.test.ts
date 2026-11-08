/**
 * Ключи хранилища по версии и каналу (спека 013): префиксы, ключи игроков и общей части, имя базы, переезд.
 * Своя подготовка (модули пересобираются под канал и версию).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { channelOf, dbName, majorOf, oldVersionUrl, storagePrefix } from '../src/app/versions/build';
import { section as walletSection } from '../src/engine/wallet/save';

describe('ключи хранилища по версии и каналу (спека 013)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.doUnmock('../src/app/version');
    vi.resetModules();
  });

  function fakeStorage(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial));
    return {
      data,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  }

  /** Модули хранилища сборки с заданным каналом и версией (как после `vite build`). */
  async function build(channel: string | undefined, version: string) {
    vi.resetModules();
    if (channel !== undefined) vi.stubEnv('VITE_KK_CHANNEL', channel);
    vi.doMock('../src/app/version', () => ({ APP_VERSION: version }));
    return import('../src/app/storage');
  }

  it('префикс: next — свой, выпуск — по мажору, у корня и vN один', () => {
    expect(storagePrefix(0, 'next')).toBe('keykick-next.');
    expect(storagePrefix(2, 'next')).toBe('keykick-next.');
    expect(storagePrefix(0, 'release')).toBe('keykick.');
    expect(storagePrefix(1, 'release')).toBe('keykick.');
    expect(storagePrefix(2, 'release')).toBe('keykick2.');
    expect(storagePrefix(3, 'release')).toBe('keykick3.');
    expect(majorOf('0.10.1')).toBe(0);
    expect(majorOf('2.0.0')).toBe(2);
    // Канал — только явное release; нет переменной или опечатка — next.
    expect(channelOf('release')).toBe('release');
    expect(channelOf(undefined)).toBe('next');
    expect(channelOf('')).toBe('next');
    expect(channelOf('Release')).toBe('next');
  });

  it('прогресс сына: выпуск 0.x и 1.x — ровно прежние ключи keykick.*', async () => {
    for (const version of ['0.10.1', '0.10.2', '1.0.0', '1.3.0']) {
      const st = await build('release', version);
      expect([st.LEGACY_KEY, st.PLAYERS_KEY, st.SHARED_KEY, st.TAB_KEY, st.MUTE_KEY]).toEqual([
        'keykick.save',
        'keykick.players',
        'keykick.session',
        'keykick.player',
        'keykick.muted',
      ]);
      expect(st.saveKey('p2')).toBe('keykick.save.p2');
    }
  });

  it('канал по умолчанию — next: ключей keykick.* нет ни у одного ключа', async () => {
    const st = await build(undefined, '0.10.1');
    for (const key of [st.LEGACY_KEY, st.PLAYERS_KEY, st.SHARED_KEY, st.TAB_KEY, st.MUTE_KEY, st.saveKey('p1')]) {
      expect(key.startsWith('keykick-next.')).toBe(true);
    }
    const v2 = await build('release', '2.0.0');
    expect(v2.PLAYERS_KEY).toBe('keykick2.players');
  });

  it('имя базы IndexedDB — от того же префикса', () => {
    expect(dbName(storagePrefix(1, 'release'))).toBe('keykick.journal');
    expect(dbName(storagePrefix(2, 'release'))).toBe('keykick2.journal');
    expect(dbName(storagePrefix(2, 'next'))).toBe('keykick-next.journal');
  });

  it('старая версия: от любого адреса — /keykick/v1/', () => {
    expect(oldVersionUrl('/keykick/')).toBe('/keykick/v1/');
    expect(oldVersionUrl('/keykick/next/')).toBe('/keykick/v1/');
    expect(oldVersionUrl('/keykick/v2/')).toBe('/keykick/v1/');
    expect(oldVersionUrl('/keykick/v12/')).toBe('/keykick/v1/');
    expect(oldVersionUrl('/')).toBe('/v1/');
  });

  /** Сохранение «как у сына»: игрок, звук выключен, сессия. */
  const sonKeys = () => ({
    'keykick.save': JSON.stringify({ version: 1, goals: 7 }),
    'keykick.muted': '1',
    'keykick.session': '{"x":1}',
  });

  for (const [name, channel, version, prefix] of [
    ['v2 выпуск', 'release', '2.0.0', 'keykick2.'],
    ['голова /next/', undefined, '2.0.0', 'keykick-next.'],
    ['голова с номером 0.10.1', undefined, '0.10.1', 'keykick-next.'],
  ] as const) {
    it(`${name}: при ключах keykick.* стартует чистой, чужие побайтно целы`, async () => {
      const before = sonKeys();
      const storage = fakeStorage(before);
      vi.stubGlobal('localStorage', storage);
      vi.stubGlobal('sessionStorage', fakeStorage());
      vi.resetModules();
      if (channel !== undefined) vi.stubEnv('VITE_KK_CHANNEL', channel);
      vi.doMock('../src/app/version', () => ({ APP_VERSION: version }));
      const p = await import('../src/app/players/active');
      const { readSection, updateSection } = await import('../src/app/save/sections');
      expect(p.activeId()).not.toBeNull();
      expect(readSection(walletSection).coins).toBe(0);
      updateSection(walletSection, (w) => ({ ...w, coins: 1 }));
      const { muted } = await import('../src/app/sound');
      expect(muted.value).toBe(false);
      muted.value = true;
      await nextTick();
      for (const [k, v] of Object.entries(before)) expect(storage.data.get(k)).toBe(v);
      const added = [...storage.data.keys()].filter((k) => !(k in before));
      expect(added.length).toBeGreaterThan(0);
      for (const k of added) expect(k.startsWith(prefix)).toBe(true);
    });
  }

  it('звук: выключенный в 0.10.1 остаётся выключенным; выбор пишется тем же текстом', async () => {
    const storage = fakeStorage({ 'keykick.muted': '1' });
    vi.stubGlobal('localStorage', storage);
    await build('release', '0.10.1');
    const { muted } = await import('../src/app/sound');
    expect(muted.value).toBe(true);
    muted.value = false;
    await nextTick();
    expect(storage.data.get('keykick.muted')).toBe('0');
    muted.value = true;
    await nextTick();
    expect(storage.data.get('keykick.muted')).toBe('1');
  });

  it('звук: хранилище сломано — без падения, выбор живёт в памяти', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
    });
    await build('release', '0.10.1');
    const { muted } = await import('../src/app/sound');
    expect(muted.value).toBe(false);
    muted.value = true;
    await nextTick();
    expect(muted.value).toBe(true);
  });
});
