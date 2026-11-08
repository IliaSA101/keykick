/**
 * Перехват ошибок и экран сбоя (спека 014-Т5, design §7): чистая часть `app/crash/crash.ts` на поддельных зависимостях.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  REPEAT_MS,
  createCrash,
  describeError,
  isChunkError,
  isHarmless,
  reportError,
  setActiveCrash,
  type CrashView,
  type Listenable,
} from '../src/app/crash/crash';
import { device } from './backupHelpers';
import { V1 } from './saveStoreHelpers';

describe('перехват ошибок (спека 014-Т5)', () => {
  const OWN = ['http://localhost/keykick/'];

  /** Перехватчик на поддельных зависимостях: показы, перезагрузки и флаги вкладки копятся рядом. */
  function rig(
    opts: { prefix?: string; channel?: 'next' | 'release'; init?: Record<string, string>; flags?: Map<string, string>; flagBroken?: boolean } = {},
  ) {
    const dev = device(opts.init ?? {}, opts.prefix === undefined ? {} : { prefix: opts.prefix, channel: opts.channel ?? 'release' });
    const flags = opts.flags ?? new Map<string, string>();
    const shown: CrashView[] = [];
    const calls = { reload: 0, home: 0, unmount: 0 };
    const crash = createCrash({
      now: () => dev.clock.now,
      log: dev.events.log,
      flush: () => dev.events.ingest(dev.store.events()),
      flag: (name, value) => {
        if (opts.flagBroken === true) return null;
        if (value === undefined) return flags.get(name) ?? null;
        if (value === null) flags.delete(name);
        else flags.set(name, value);
        return value;
      },
      reload: () => void (calls.reload += 1),
      home: () => void (calls.home += 1),
      status: () => dev.store.status(),
      show: (v) => void shown.push(v),
      own: OWN,
    });
    crash.attachMain({ unmount: () => void (calls.unmount += 1) });
    return { ...dev, flags, shown, calls, crash };
  }

  /** Окно: слушатели хранятся по имени события, тест вызывает их сам. */
  function fakeWindow() {
    const handlers = new Map<string, (ev: Event) => void>();
    const target: Listenable = { addEventListener: (type, fn) => void handlers.set(type, fn) };
    const fire = (type: string, ev: object): void => (handlers.get(type) as (e: object) => void)(ev);
    return { target, fire };
  }

  it('ошибка окна, промис и роутер — один экран сбоя; повторные только в журнал', () => {
    // Ловит: экран сбоя поверх экрана сбоя (петля) или молчание при ошибке в промисе/роутере.
    const r = rig();
    const w = fakeWindow();
    r.crash.listen(w.target);
    setActiveCrash(r.crash);
    w.fire('error', { error: new Error('рендер'), message: 'x', filename: 'http://localhost/keykick/assets/a.js' });
    expect(r.shown).toEqual([{ kind: 'error', again: false }]);
    expect(r.calls.unmount).toBe(1);
    w.fire('unhandledrejection', { reason: new Error('промис') });
    reportError(new Error('роутер'), 'router');
    expect(r.shown).toHaveLength(1);
    const texts = r.events.list().map((e) => e.text);
    expect(texts.filter((t) => /^(window|promise|router):/.test(t))).toHaveLength(3);
    setActiveCrash(null);
  });

  it('роутер без перехватчика не бросает: ошибка уходит в консоль', () => {
    // Ловит: reportError, падающий сам, пока installCrash ещё не отработал.
    setActiveCrash(null);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => reportError(new Error('x'), 'router')).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('безвредное — только в журнал: ResizeObserver, Script error., чужой файл', () => {
    // Ловит: экран сбоя из-за расширения браузера или безобидного ResizeObserver.
    const r = rig();
    const w = fakeWindow();
    r.crash.listen(w.target);
    w.fire('error', { message: 'ResizeObserver loop completed with undelivered notifications.', filename: '' });
    w.fire('error', { message: 'Script error.', filename: '' });
    w.fire('error', { error: new Error('расширение'), message: 'x', filename: 'chrome-extension://abc/content.js' });
    expect(r.shown).toEqual([]);
    expect(r.crash.crashed()).toBe(false);
    expect(r.events.list().filter((e) => e.kind === 'error' && e.text.includes('(harmless)'))).toHaveLength(3);
    // Наш файл и пустое имя файла (рендер, промис) — не безвредное.
    expect(isHarmless({ text: 'Error: x', filename: 'http://localhost/keykick/assets/a.js' }, OWN)).toBe(false);
    expect(isHarmless({ text: 'Error: x' }, OWN)).toBe(false);
    expect(isHarmless({ text: 'Error: x', filename: 'http://evil.example/a.js' }, OWN)).toBe(true);
    // Отказ промиса без файла: безвреден только если весь стек из расширения.
    const ext = 'Error: x\n    at f (chrome-extension://abc/c.js:1:2)\n    at g (chrome-extension://abc/d.js:3:4)';
    expect(isHarmless({ text: 'Error: x', stack: ext }, OWN)).toBe(true);
    expect(isHarmless({ text: 'Error: x', stack: 'Error: x\nf@moz-extension://abc/c.js:1:2' }, OWN)).toBe(true);
    expect(isHarmless({ text: 'Error: x', stack: `${ext}\n    at h (http://localhost/keykick/assets/a.js:1:1)` }, OWN)).toBe(false);
    expect(isHarmless({ text: 'Error: x', stack: 'Error: x\n    at h (http://localhost/keykick/assets/a.js:1:1)' }, OWN)).toBe(false);
    expect(isHarmless({ text: 'Error: x', stack: 'Error: x' }, OWN)).toBe(false);
  });

  it('сбой загрузки чанка — одна тихая перезагрузка; вторая за 30 с (после перезагрузки) — экран; через 30 с снова тихая', () => {
    // Ловит: цикл перезагрузок на сломанной выкладке и молчаливый клик по ссылке на старой вкладке.
    const flags = new Map<string, string>();
    const r = rig({ flags });
    const w = fakeWindow();
    r.crash.listen(w.target);
    let prevented = 0;
    w.fire('vite:preloadError', { payload: new Error('x'), preventDefault: () => void (prevented += 1) });
    expect([r.calls.reload, r.shown.length, prevented]).toEqual([1, 0, 1]);
    // Страница после перезагрузки: те же флаги вкладки, новый перехватчик.
    const after = rig({ flags });
    after.crash.report(new TypeError('Failed to fetch dynamically imported module: http://x/a.js'), 'router');
    expect([after.calls.reload, after.shown]).toEqual([0, [{ kind: 'error', again: false }]]);
    // Спустя REPEAT_MS перезагрузка снова допустима (другая выкладка).
    const r2 = rig();
    r2.crash.report(new TypeError('Importing a module script failed.'), 'router');
    expect(r2.calls.reload).toBe(1);
    r2.clock.now += REPEAT_MS + 1;
    const r3 = rig({ flags: r2.flags });
    r3.clock.now = r2.clock.now;
    r3.crash.report(new TypeError('Importing a module script failed.'), 'router');
    expect(r3.calls.reload).toBe(1);
    expect(isChunkError('TypeError: Failed to fetch dynamically imported module')).toBe(true);
    expect(isChunkError('TypeError: x is not a function')).toBe(false);
  });

  it('после тихой перезагрузки всё, что бросит умирающая страница, — только в журнал, без экрана', () => {
    // Ловит: экран сбоя на долю секунды перед перезагрузкой (vue-router после preventDefault бросает «Couldn't resolve component», затем отказ промиса).
    const r = rig();
    const w = fakeWindow();
    r.crash.listen(w.target);
    w.fire('vite:preloadError', { payload: new Error('x'), preventDefault: () => undefined });
    expect(r.calls.reload).toBe(1);
    r.crash.report(new Error("Couldn't resolve component"), 'router');
    w.fire('unhandledrejection', { reason: new Error('Failed to fetch dynamically imported module') });
    expect([r.shown, r.calls.reload, r.crash.crashed(), r.calls.unmount]).toEqual([[], 1, false, 0]);
    expect(r.events.list().filter((e) => /^(router|promise):/.test(e.text))).toHaveLength(2);
  });

  it('флаг вкладки не записывается — перезагрузки не будет, сразу экран; карточка «переполнено» не повторяется и без флага', () => {
    // Ловит: бесконечная перезагрузка при закрытом sessionStorage и карточка на каждый переход.
    const r = rig({ flagBroken: true });
    r.crash.report(new TypeError('Failed to fetch dynamically imported module'), 'router');
    expect([r.calls.reload, r.shown]).toEqual([0, [{ kind: 'error', again: false }]]);
    const f = rig({ flagBroken: true });
    expect(f.crash.showFullOnce()).toBe(true);
    expect(f.crash.showFullOnce()).toBe(false);
    expect(f.shown).toHaveLength(1);
  });

  it('проверка слоя: «новее» → «Обновить», переполнение → карточка раз за сеанс, сбой уже показан → ничего', () => {
    // Ловит: перепутанные признаки статуса и повтор экрана на каждом переходе роутера (мутант на настоящем слое — tests/crashStatus.test.ts).
    const none = { readOnly: false, migrateFailed: false, storageFull: false };
    const a = rig();
    expect(a.crash.check(none)).toBe(false);
    expect(a.crash.check({ ...none, readOnly: true })).toBe(true);
    expect([a.shown, a.crash.crashed()]).toEqual([[{ kind: 'newer', again: false }], true]);
    expect(a.crash.check({ ...none, migrateFailed: true })).toBe(false);
    expect(a.shown).toHaveLength(1);
    const b = rig();
    expect(b.crash.check({ ...none, storageFull: true })).toBe(true);
    expect(b.crash.check({ ...none, storageFull: true })).toBe(false);
    expect([b.shown, b.crash.crashed()]).toEqual([[{ kind: 'full', again: true }], false]);
    const c = rig();
    expect(c.crash.check({ ...none, migrateFailed: true, readOnly: true })).toBe(true);
    expect(c.shown).toEqual([{ kind: 'migrate', again: true }]);
    // recheck берёт состояние у зависимости status — его и зовёт роутер.
    const d = rig({ init: { 'keykick.players': '{}' } });
    expect(d.crash.recheck()).toBe(false);
  });

  it('«На главную» и сразу новый сбой — «Позови папу»; через 30 с — снова обычный', () => {
    // Ловит: ребёнок крутит «На главную» вхолостую по сломанному экрану.
    const r = rig();
    r.crash.report(new Error('1'), 'vue');
    r.crash.goHome();
    expect(r.calls.home).toBe(1);
    expect(r.flags.get('crash.home')).toBe(String(r.clock.now));
    const second = rig();
    second.flags.set('crash.home', String(second.clock.now));
    second.crash.report(new Error('2'), 'vue');
    expect(second.shown).toEqual([{ kind: 'error', again: true }]);
    const third = rig();
    third.flags.set('crash.home', String(third.clock.now - REPEAT_MS - 1));
    third.crash.report(new Error('3'), 'vue');
    expect(third.shown).toEqual([{ kind: 'error', again: false }]);
  });

  it('миграция бросила — игра не монтируется; «новее» — «Обновить», после него «Позови папу»', () => {
    // Ловит: игра поверх непрочитанного сохранения (запись затёрла бы его) и бесконечное «Обновить».
    const m = rig();
    m.crash.showMigrate();
    expect(m.crash.crashed()).toBe(true);
    expect(m.shown).toEqual([{ kind: 'migrate', again: true }]);
    const n = rig();
    n.crash.showNewer();
    expect(n.shown).toEqual([{ kind: 'newer', again: false }]);
    n.crash.update();
    expect(n.calls.reload).toBe(1);
    n.crash.showNewer();
    expect(n.shown[1]).toEqual({ kind: 'newer', again: true });
  });

  it('карточка «хранилище переполнено» — раз за сеанс, игру не снимает и не считается сбоем', () => {
    // Ловит: карточка на каждый тик таймера и снятие игры из-за полного хранилища.
    const r = rig();
    expect(r.crash.showFullOnce()).toBe(true);
    expect(r.crash.showFullOnce()).toBe(false);
    expect(r.shown).toEqual([{ kind: 'full', again: true }]);
    expect(r.calls.unmount).toBe(0);
    expect(r.crash.crashed()).toBe(false);
    const c = rig();
    c.crash.report(new Error('x'), 'vue');
    expect(c.crash.showFullOnce()).toBe(false);
  });

  it('ошибка при снятии игры глотается, экран сбоя всё равно показан', () => {
    // Ловит: сломанный рендер, который роняет и показ экрана.
    const r = rig();
    r.crash.attachMain({
      unmount: () => {
        throw new Error('unmount');
      },
    });
    r.crash.report(new Error('x'), 'vue');
    expect(r.shown).toHaveLength(1);
  });

  it('события слоя попадают в журнал раньше самой ошибки', () => {
    // Ловит: карантин и миграция, которых нет в файле для папы, потому что журнал дополнялся только при выгрузке.
    const r = rig({ prefix: 'keykick-next.', channel: 'next', init: { 'keykick-next.save.a': '{сломано' } });
    r.store.load('a');
    r.crash.report(new Error('после'), 'vue');
    const kinds = r.events.list().map((e) => `${e.kind}:${e.text.split(' ')[0]}`);
    const storageAt = kinds.findIndex((k) => k.startsWith('storage:'));
    const errorAt = kinds.findIndex((k) => k.startsWith('error:vue'));
    expect(storageAt).toBeGreaterThanOrEqual(0);
    expect(errorAt).toBeGreaterThan(storageAt);
  });

  it('режим v1: сбой, «новее», переполнение и файл не добавляют в хранилище ни одного ключа', async () => {
    // Ловит: перехватчик, пишущий в хранилище сына (ключи `keykick.` — на тех же живёт 0.10.1).
    const r = rig({ prefix: V1, channel: 'release' });
    r.seed([['a', 'Миша']], { a: 7 });
    const before = new Map(r.mem.data);
    r.crash.report(new Error('x'), 'vue');
    r.crash.showNewer();
    r.crash.showFullOnce();
    await r.backup.downloadBackup();
    expect(new Map(r.mem.data)).toEqual(before);
    // Файл для папы собирается и в v1, с журналом, где ошибка уже есть.
    const file = JSON.parse(r.files[0]?.text ?? '{}') as { events?: Array<{ text: string }> };
    expect(file.events?.some((e) => e.text.startsWith('vue:'))).toBe(true);
  });

  it('режим envelope: основной ключ игрока побайтно прежний после сбоя', () => {
    // Ловит: сбой, переписавший сохранение.
    const r = rig({ prefix: 'keykick-next.', channel: 'next' });
    r.seed([['a', 'Миша']], { a: 7 });
    const key = 'keykick-next.save.a';
    const before = r.mem.data.get(key);
    expect(before).toBeDefined();
    r.crash.report(new Error('x'), 'vue');
    r.crash.showMigrate();
    expect(r.mem.data.get(key)).toBe(before);
  });

  it('описание ошибки: Error, строка, объект, круговая ссылка; длинное режется', () => {
    // Ловит: падение самого перехватчика на странном брошенном значении.
    expect(describeError(new Error('м')).text).toBe('Error: м');
    expect(describeError('просто строка').text).toBe('просто строка');
    expect(describeError({ a: 1 }).text).toBe('{"a":1}');
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(() => describeError(loop)).not.toThrow();
    expect(describeError(undefined).text).toBe('undefined');
    expect(describeError('я'.repeat(1000)).text).toHaveLength(300);
    expect(describeError(new Error('x')).stack?.length).toBeLessThanOrEqual(2048);
  });
});
