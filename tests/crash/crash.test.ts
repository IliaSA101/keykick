/**
 * Перехват сбоев: журнал ≤ 200, безвредное не пугает, окно «первое / позови взрослого», сбой ловится до монтирования (К6).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCrash, type CrashTarget, type CrashView } from '../../src/app/crash/crash';
import { goHomeNow } from '../../src/app/crash/home';
import { guardRoute, type EntrySource } from '../../src/app/router/guard';
import { AGAIN_WINDOW_MS, LOG_LIMIT, STACK_LIMIT, TEXT_LIMIT, crashStep, isHarmless, pushEvent } from '../../src/app/crash/log';

const ORIGIN = 'https://iliasa101.github.io';

/** Подставное окно: слушатели по имени события. */
function fakeWindow() {
  const handlers = new Map<string, (e: never) => void>();
  const target: CrashTarget = { addEventListener: (type, fn) => void handlers.set(type, fn) };
  const fire = (type: string, e: object) => (handlers.get(type) as ((e: object) => void) | undefined)?.(e);
  return { target, fire };
}

function make(now = 1_000) {
  const clock = { t: now };
  const homes: number[] = [];
  const crash = createCrash({ now: () => clock.t, origin: ORIGIN, goHome: () => void homes.push(clock.t) });
  const win = fakeWindow();
  crash.listen(win.target);
  return { crash, win, clock, homes };
}

describe('журнал событий', () => {
  // Ловит: журнал растёт без предела (ТЗ-12.15) или режет не старые, а новые записи.
  it('держит последние 200 записей, старые выбрасывает', () => {
    let log: ReturnType<typeof pushEvent> = [];
    for (let i = 0; i < LOG_LIMIT + 5; i++) log = pushEvent(log, { t: i, kind: 'action', text: `e${i}` });
    expect(log).toHaveLength(LOG_LIMIT);
    expect(log[0]?.text).toBe('e5');
    expect(log.at(-1)?.text).toBe(`e${LOG_LIMIT + 4}`);
  });

  // Ловит: огромный стек раздувает журнал (предел 64 КБ в 014 design §6).
  it('режет текст до 300 знаков и стек до 2 КБ; исходный журнал не меняется', () => {
    const before = pushEvent([], { t: 1, kind: 'error', text: 'x'.repeat(1000), stack: 's'.repeat(5000) });
    const rec = before[0];
    expect(rec?.text).toHaveLength(TEXT_LIMIT);
    expect(rec?.stack).toHaveLength(STACK_LIMIT);
    const after = pushEvent(before, { t: 2, kind: 'action', text: 'b' });
    expect(before).toHaveLength(1);
    expect(after).toHaveLength(2);
  });
});

describe('безвредное и шаг окна', () => {
  // Ловит: окно сбоя из-за перерисовки ResizeObserver или расширения браузера.
  it('ResizeObserver, «Script error.» и чужой файл — безвредны; свой файл — нет', () => {
    expect(isHarmless('ResizeObserver loop completed with undelivered notifications.', '', ORIGIN)).toBe(true);
    expect(isHarmless('Script error.', '', ORIGIN)).toBe(true);
    expect(isHarmless('boom', 'chrome-extension://abc/x.js', ORIGIN)).toBe(true);
    expect(isHarmless('boom', `${ORIGIN}/keykick/assets/a.js`, ORIGIN)).toBe(false);
    expect(isHarmless('boom', '', ORIGIN)).toBe(false);
  });

  // Ловит: первое окно показывается как «Позови взрослого» (или наоборот) на границе 30 с.
  it('шаг 2 — только если с «На главную» прошло меньше 30 с', () => {
    expect(crashStep(5_000, null)).toBe(1);
    expect(crashStep(5_000, 4_000)).toBe(2);
    expect(crashStep(4_000 + AGAIN_WINDOW_MS - 1, 4_000)).toBe(2);
    expect(crashStep(4_000 + AGAIN_WINDOW_MS, 4_000)).toBe(1);
  });
});

describe('перехват (К6)', () => {
  // К6: ловит — сбой до подписки окна теряется (белый экран): окно обязано появиться при подписке.
  it('К6 сбой до монтирования не теряется: окно появляется, как только его подписали', () => {
    const { crash, win } = make();
    win.fire('error', { message: 'бросок при оценке модуля', filename: `${ORIGIN}/keykick/assets/index.js`, error: new Error('бросок при оценке модуля') });
    expect(crash.crashed()).toBe(true);
    const seen: CrashView[] = [];
    crash.setPresenter((v) => seen.push(v));
    expect(seen).toHaveLength(1);
    expect(seen[0]?.step).toBe(1);
    expect(seen[0]?.events[0]?.text).toBe('бросок при оценке модуля');
  });

  // К6: ловит — необработанное обещание и errorHandler Vue не доходят до журнала.
  it('К6 unhandledrejection и сбой Vue попадают в журнал и показывают окно', () => {
    const { crash, win } = make();
    const seen: CrashView[] = [];
    crash.setPresenter((v) => seen.push(v));
    win.fire('unhandledrejection', { reason: new Error('промис') });
    crash.report('vue', new Error('компонент'));
    expect(crash.events().map((e) => `${e.kind}:${e.text}`)).toEqual(['rejection:промис', 'vue:компонент']);
    expect(seen).toHaveLength(2);
  });

  // Ловит: безвредная ошибка (расширение) показывает окно ребёнку.
  it('безвредное пишется в журнал, окна нет', () => {
    const { crash, win } = make();
    win.fire('error', { message: 'ResizeObserver loop limit exceeded', filename: '' });
    expect(crash.events()).toHaveLength(1);
    expect(crash.crashed()).toBe(false);
  });

  // Ловит: после «На главную» повторный сбой снова «первый» — ребёнок не получает кнопку файла.
  it('«На главную» запоминает время; сбой сразу после — шаг 2', () => {
    const { crash, clock, homes } = make(10_000);
    crash.goHome();
    expect(homes).toEqual([10_000]);
    clock.t = 12_000;
    const seen: CrashView[] = [];
    crash.setPresenter((v) => seen.push(v));
    crash.report('vue', new Error('снова'));
    expect(seen.at(-1)?.step).toBe(2);
  });

  // Ловит: кнопка «Сохранить файл ошибки» молчит — заглушка-событие должна дойти до подписчика (его делает Т11).
  it('«Сохранить файл ошибки» — событие с журналом для подписчика', () => {
    const { crash } = make();
    crash.report('vue', new Error('x'));
    const got: number[] = [];
    crash.onSaveFile((events) => got.push(events.length));
    crash.requestSaveFile();
    expect(got).toEqual([1]);
  });

  // К6: ловит — перехват перестал быть первым импортом main.ts (бросок при оценке App.vue дал бы белый экран).
  it('К6 первый импорт main.ts — перехват из src/app/crash/', () => {
    const main = readFileSync(join(import.meta.dirname, '../../src/main.ts'), 'utf8');
    const first = /^\s*import\s+(?:[^'"]*from\s+)?['"]([^'"]+)['"]/m.exec(main.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''));
    expect(first?.[1]).toMatch(/^\.\/app\/crash\//);
  });
});

describe('«На главную» из окна сбоя (К6)', () => {
  /** Подставное окно: присваивание hash — «разбудили роутер», replaceState и reload — по порядку. */
  function homeWindow() {
    const calls: string[] = [];
    return {
      calls,
      win: {
        history: { replaceState: (_s: unknown, _u: string, url: string) => void calls.push(`replace:${url}`) },
        location: {
          reload: () => void calls.push('reload'),
          set hash(v: string) {
            calls.push(`hash:${v}`);
          },
        },
      },
    };
  }

  // К6: ловит — «На главную» ставит адрес присваиванием `location.hash`: роутер просыпается, охрана при сбое отменяет переход,
  // vue-router откатывает адрес назад, перезагрузка пропадает — кнопка от настоящего Enter и клика «ничего не делает» (проход тестировщик 18.11).
  it('К6 адрес Дома ставится replaceState (роутер не будится), потом reload', () => {
    const { win, calls } = homeWindow();
    goHomeNow(win);
    expect(calls).toEqual(['replace:#/home', 'reload']);
  });

  // К6: ловит — при сбое охрана не пускает на /home (отмена), поэтому путь «через роутер» к Дому закрыт и держаться за него нельзя.
  it('К6 при сбое охрана отменяет переход на /home — значит, окно идёт мимо роутера', async () => {
    const src: EntrySource = {
      entryState: () => ({ device: 'ok', players: ['a'], tabPid: 'a', player: 'ok' }),
      choose: () => Promise.resolve(),
    };
    expect(await guardRoute({ path: '/home', fullPath: '/home' }, src, () => true)).toBe(false);
  });

  // К6: ловит — boot.ts вернул `location.hash = …` (или другой путь через роутер) вместо goHomeNow.
  it('К6 boot.ts: «На главную» идёт через goHomeNow, без присваивания location.hash', () => {
    const boot = readFileSync(join(import.meta.dirname, '../../src/app/crash/boot.ts'), 'utf8').replace(/\/\/.*$/gm, '');
    expect(boot).toContain('goHomeNow(window)');
    expect(boot).not.toMatch(/location\.hash\s*=/);
  });
});
