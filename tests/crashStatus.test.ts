/**
 * Состояние настоящего слоя сохранения → экран сбоя (спека 014-Т5, развилка 014-Р12): `migrateFailed` и `readOnly`
 * берутся из `store.status()`, а не из подставных значений. Миграций до v2.0 нет, поэтому «миграция бросила»
 * достаётся подменой `classify`/`migrate` движка на помеченном тексте; остальной слой — настоящий.
 */
import { describe, expect, it, vi } from 'vitest';
import { createCrash, type CrashView } from '../src/app/crash/crash';
import { SAVE_DRAFT } from '../src/engine/save/format';
import { device } from './backupHelpers';

vi.mock('../src/engine/save/format', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/engine/save/format')>();
  const marked = (text: string | null): boolean => text?.includes('"app":"migrate-bug"') === true;
  return {
    ...real,
    classify: (text: string | null, ...rest: unknown[]) =>
      marked(text)
        ? { kind: 'migrate', envelope: JSON.parse(text ?? '{}') as unknown, from: 0 }
        : (real.classify as (t: string | null, ...r: unknown[]) => unknown)(text, ...rest),
    migrate: (env: { app: string }, ...rest: unknown[]) =>
      env.app === 'migrate-bug'
        ? { ok: false, at: 1, error: new Error('bug') }
        : (real.migrate as (e: unknown, ...r: unknown[]) => unknown)(env, ...rest),
  };
});

function rigOver(init: Record<string, string>) {
  const dev = device(init);
  const shown: CrashView[] = [];
  const crash = createCrash({
    now: () => dev.clock.now,
    log: dev.events.log,
    flush: () => dev.events.ingest(dev.store.events()),
    flag: () => null,
    reload: () => undefined,
    status: () => dev.store.status(),
    home: () => undefined,
    show: (v) => void shown.push(v),
    own: [],
  });
  return { ...dev, crash, shown };
}

const KEY = 'keykick-next.save.a';
const env = (app: string, draft = SAVE_DRAFT): string =>
  JSON.stringify({ format: 0, draft, rev: 5, app, sections: { probe: {} } });

describe('слой сохранения → экран сбоя', () => {
  it('миграция бросила в настоящем слое — проверка показывает «Позови папу» и не пускает игру', () => {
    // Ловит: игра поверх непрочитанного сохранения (мутант: `status.migrateFailed` → false в crash.check).
    const r = rigOver({ [KEY]: env('migrate-bug') });
    r.store.load('a');
    expect(r.store.status().migrateFailed).toBe(true);
    expect(r.crash.recheck()).toBe(true);
    expect(r.shown).toEqual([{ kind: 'migrate', again: true }]);
    expect(r.crash.crashed()).toBe(true);
    // Повторная проверка (следующий переход роутера) экран не дублирует.
    expect(r.crash.recheck()).toBe(false);
    expect(r.shown).toHaveLength(1);
  });

  it('сохранение новее программы в настоящем слое — «Игра обновилась»', () => {
    // Ловит: перепутанный признак `readOnly` (мутант: `status.readOnly` → false).
    const r = rigOver({ [KEY]: env('9', SAVE_DRAFT + 1) });
    r.store.load('a');
    expect(r.store.status().readOnly).toBe(true);
    expect(r.crash.recheck()).toBe(true);
    expect(r.shown).toEqual([{ kind: 'newer', again: false }]);
  });

  it('целое сохранение — экрана нет, слой не тронут', () => {
    // Ловит: экран на здоровом запуске.
    const r = rigOver({ [KEY]: env('0.10.1') });
    r.store.load('a');
    expect(r.crash.recheck()).toBe(false);
    expect(r.shown).toEqual([]);
  });
});
