// План перезагрузки после загрузки файла (014-Р13, 018-Р26): пауза, ожидание журнала, уход со страницы. Часы — vitest.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReloadPlan } from '../src/app/save/reloadPlan';

describe('план перезагрузки', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => vi.useRealTimers());

  function rig() {
    const calls: string[] = [];
    const plan = createReloadPlan({
      setTimer: (cb, ms) => setTimeout(cb, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      reload: () => void calls.push('reload'),
      clearReport: () => void calls.push('clearReport'),
      delayMs: 1500,
      journalMaxMs: 3000,
    });
    return { plan, calls };
  }
  const never = new Promise<number>(() => undefined);

  it('без журнала: перезагрузка ровно через 1,5 с, ключ итога не трогаем', async () => {
    // Ловит: перезагрузка раньше паузы (итог не прочитан) или позже/дважды.
    const { plan, calls } = rig();
    plan.schedule();
    await vi.advanceTimersByTimeAsync(1499);
    expect(calls).toEqual([]);
    expect(plan.pending()).toBe(true);
    await vi.advanceTimersByTimeAsync(2);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toEqual(['reload']);
    expect(plan.pending()).toBe(false);
  });

  it('журнал успел до паузы: ждём паузу целиком; журнал позже паузы — перезагрузка по его окончании', async () => {
    // Ловит: перезагрузка сразу по окончании журнала (итог не прочитан) или без ожидания журнала после паузы.
    const early = rig();
    early.plan.schedule(Promise.resolve(5));
    await vi.advanceTimersByTimeAsync(1000);
    expect(early.calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(600);
    expect(early.calls).toEqual(['reload']);

    const late = rig();
    let done: (n: number) => void = () => undefined;
    late.plan.schedule(new Promise<number>((r) => (done = r)));
    await vi.advanceTimersByTimeAsync(2000); // пауза прошла, журнал ещё идёт
    expect(late.calls).toEqual([]);
    done(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(late.calls).toEqual(['reload']);
  });

  it('журнал не дождались: перезагрузка не позже чем через 3 с после паузы; отказ журнала не мешает', async () => {
    // Ловит: зависшее слияние держит страницу на старой памяти навсегда.
    const hung = rig();
    hung.plan.schedule(never);
    await vi.advanceTimersByTimeAsync(1500 + 2999);
    expect(hung.calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    expect(hung.calls).toEqual(['reload']);

    const failed = rig();
    failed.plan.schedule(Promise.reject(new Error('idb')));
    await vi.advanceTimersByTimeAsync(1600);
    expect(failed.calls).toEqual(['reload']);
  });

  it('уход со страницы в паузе: сразу, ключ снят, таймер не перезагрузит второй раз', async () => {
    // Ловит: уход, дожидающийся таймера или журнала, — главная успевает записать старую память поверх загруженного.
    const { plan, calls } = rig();
    plan.schedule(never);
    await vi.advanceTimersByTimeAsync(500);
    plan.leave();
    expect(calls).toEqual(['clearReport', 'reload']);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toEqual(['clearReport', 'reload']);
  });

  it('уход при ожидании журнала (пауза уже прошла): тоже сразу и ключ снят', async () => {
    // Ловит: флаг «ждём» снят вместе с таймером паузы — уход в ожидании журнала не перезагружает и не снимает ключ.
    const { plan, calls } = rig();
    plan.schedule(never);
    await vi.advanceTimersByTimeAsync(2000);
    expect(calls).toEqual([]);
    expect(plan.pending()).toBe(true);
    plan.leave();
    expect(calls).toEqual(['clearReport', 'reload']);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toEqual(['clearReport', 'reload']);
  });

  it('уход без назначенной перезагрузки и после неё — ничего; повторное назначение игнорируется', async () => {
    // Ловит: перезагрузка и снятие ключа при обычном уходе со страницы (без загрузки файла) или двойная перезагрузка.
    const idle = rig();
    idle.plan.leave();
    expect(idle.calls).toEqual([]);

    const { plan, calls } = rig();
    plan.schedule();
    plan.schedule(never);
    await vi.advanceTimersByTimeAsync(1600);
    expect(calls).toEqual(['reload']);
    plan.leave();
    expect(calls).toEqual(['reload']);
  });
});
