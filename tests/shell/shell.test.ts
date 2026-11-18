/**
 * Оболочка и части ЭБ (063 Т4, К7): сцена-масштаб, плашки по `status`, строка низа, круговой фокус модалки, охрана на переходе.
 * У каждого теста строка «Ловит:».
 */
import { describe, expect, it, vi } from 'vitest';
import { ENTER_DELAY, cycleIndex, enterAllowed } from '../../src/components/panel/focusCycle';
import { clipName, oldVersionUrl } from '../../src/components/shell/footer';
import { isNarrowStage, stageScale } from '../../src/components/shell/stageScale';
import { noticeFor, type ShellStatus } from '../../src/components/shell/status';
import { guardRoute, type EntrySource } from '../../src/app/router/guard';
import type { Status } from '../../src/app/save/session';
import type { EntryInput } from '../../src/engine/players/entry';

describe('сцена-масштаб (К7)', () => {
  it('К7: 1920×1080 — множитель 1,6875, ширина сцены 1137,78; 1024×640 — единица', () => {
    // Ловит: кадр игры на 1920 не совпадает с макетом ЭБ (множитель и ширина сцены — из stage.css макета).
    const big = stageScale(1920, 1080);
    expect(big.scale).toBeCloseTo(1.6875, 4);
    expect(big.width).toBeCloseTo(1137.78, 2);
    expect(big.height).toBeCloseTo(640, 6);
    expect(stageScale(1024, 640)).toEqual({ scale: 1, width: 1024, height: 640 });
  });

  it('К7: узкое высокое окно считается по ширине, нулевое — единицей', () => {
    // Ловит: сцена шире окна (min заменён на max) или деление на ноль при свёрнутом окне.
    const tall = stageScale(1024, 1000);
    expect(tall.scale).toBe(1);
    expect(tall.height).toBe(1000);
    expect(stageScale(0, 0)).toEqual({ scale: 1, width: 1024, height: 640 });
  });

  it('К10: сцена 1024×640 и 1024×768 — узкая (кадры макета для 1024), 1920×1080 и 1280×720 — нет (кадры для 1920)', () => {
    // Ловит: окна первого запуска берут числа не из того кадра макета: на 1024 окно «Что изменится» уходит за край, на 1920 — съёживается.
    expect(isNarrowStage(stageScale(1024, 640).width)).toBe(true);
    expect(isNarrowStage(stageScale(1024, 768).width)).toBe(true);
    expect(isNarrowStage(stageScale(1920, 1080).width)).toBe(false);
    expect(isNarrowStage(stageScale(1280, 720).width)).toBe(false);
    expect(isNarrowStage(stageScale(0, 0).width)).toBe(true);
  });
});

describe('плашки сеанса (К7)', () => {
  it('К7: у каждого состояния кроме ok есть плашка; busy называет игрока', () => {
    // Ловит: состояние сеанса без плашки — запись молча не идёт, ребёнок не знает почему (З1).
    const all: ShellStatus[] = ['ok', 'busy', 'readonly', 'quota', 'conflict', 'broken'];
    expect(noticeFor('ok', 'Миша')).toBeNull();
    for (const s of all.filter((x) => x !== 'ok')) expect(noticeFor(s, 'Миша')?.text.length).toBeGreaterThan(0);
    expect(noticeFor('busy', 'Миша')?.text).toBe('Миша уже играет в другой вкладке');
    expect(noticeFor('busy', '')?.text).not.toContain('undefined');
  });

  it('К7: значения ShellStatus совпадают со Status моста сохранения', () => {
    // Ловит: мост добавил состояние, а оболочка о нём не знает (тип разошёлся) — vue-tsc краснеет на присваивании.
    const fromSession: ShellStatus = 'conflict' satisfies Status;
    const toSession: Status = fromSession;
    expect(toSession).toBe('conflict');
  });
});

describe('строка низа', () => {
  it('имя длиннее 20 знаков урезается по знакам с многоточием; адрес старой версии — от адреса сборки', () => {
    // Ловит: «Александра … ·» (css-многоточие после пробела) и ссылку «Старая версия» мимо /keykick/v1/.
    expect(clipName('Миша')).toBe('Миша');
    expect(clipName('Александра Македонская Вторая')).toBe('Александра Македонск…');
    expect(oldVersionUrl('/keykick/')).toBe('/keykick/v1/');
    expect(oldVersionUrl('/keykick/next/')).toBe('/keykick/v1/');
    expect(oldVersionUrl('/')).toBe('/v1/');
  });
});

describe('фокус модалки (К7)', () => {
  it('К7: Tab идёт по кругу вперёд и назад, из-за окна — на край, пустое окно — −1', () => {
    // Ловит: фокус уходит из модалки на страницу под затемнением (Tab после последней кнопки).
    expect(cycleIndex(3, 0, false)).toBe(1);
    expect(cycleIndex(3, 2, false)).toBe(0);
    expect(cycleIndex(3, 0, true)).toBe(2);
    expect(cycleIndex(3, 1, true)).toBe(0);
    expect(cycleIndex(3, -1, false)).toBe(0);
    expect(cycleIndex(3, -1, true)).toBe(2);
    expect(cycleIndex(1, 0, false)).toBe(0);
    expect(cycleIndex(0, -1, false)).toBe(-1);
  });
});

describe('Enter в цепочке окон (К10)', () => {
  const at = (now: number, repeat = false) => enterAllowed({ repeat, openedAt: 1000, now, delay: ENTER_DELAY });

  it('К10: быстрый двойной Enter и удержание не проходят в только что открытое окно', () => {
    // Ловит: второй Enter двойного нажатия на «Выбрать» попадал на «Дальше» и проскакивал приветствие.
    expect(at(1000)).toBe(false);
    expect(at(1000 + ENTER_DELAY - 1)).toBe(false);
    expect(at(1000 + ENTER_DELAY)).toBe(true);
    expect(at(5000, true)).toBe(false); // держат клавишу: повтор не считается
    expect(at(5000)).toBe(true);
  });
});

describe('охрана входа на переходе (К9)', () => {
  const src = (state: Partial<ReturnType<EntrySource['entryState']>>, choose = vi.fn(() => Promise.resolve())): EntrySource & { choose: typeof choose } => ({
    entryState: (): Pick<EntryInput, 'device' | 'players' | 'tabPid' | 'player'> => ({ device: 'ok', players: ['a'], tabPid: 'a', player: 'ok', ...state }),
    choose,
  });
  const to = (p: string): { path: string; fullPath: string } => ({ path: p, fullPath: p });

  it('К9: пустое устройство ведёт на #/start, родитель и /dev/* пускаются всегда', async () => {
    // Ловит: пустой Дом без игрока (З2) или охрана, закрывающая родителю вход.
    const empty = src({ device: 'absent', players: [], tabPid: undefined, player: 'none' });
    expect(await guardRoute(to('/home'), empty, () => false)).toBe('/start');
    expect(await guardRoute(to('/parent'), empty, () => false)).toBe(true);
    expect(await guardRoute(to('/dev/kit'), empty, () => false)).toBe(true);
  });

  it('К9: единственный игрок выбирается сам, и вход пускает; при сбое переход отменён', async () => {
    // Ловит: вкладка без игрока попадает на Дом без `choose`; переход идёт поверх окна сбоя.
    const one = src({ tabPid: undefined, player: 'none' });
    let chosen = false;
    one.entryState = (): Pick<EntryInput, 'device' | 'players' | 'tabPid' | 'player'> => ({ device: 'ok', players: ['a'], tabPid: chosen ? 'a' : undefined, player: chosen ? 'ok' : 'none' });
    const choose = vi.fn(() => {
      chosen = true;
      return Promise.resolve();
    });
    one.choose = choose;
    expect(await guardRoute(to('/home'), one, () => false)).toBe(true);
    expect(choose).toHaveBeenCalledWith('a');
    expect(await guardRoute(to('/home'), src({}), () => true)).toBe(false);
  });

  it('К14: телефон — «Открой на компьютере» до всего, сохранение не читается и не трогается; на компьютере #/phone ведёт домой', async () => {
    // Ловит: телефон открывает хранилище (`entryState`, `choose` берёт замок и пишет `tabPid`) или попадает на #/start, #/parent, Дом.
    const choose = vi.fn(() => Promise.resolve());
    const spy = src({}, choose);
    const entryState = vi.spyOn(spy, 'entryState');
    for (const path of ['/home', '/start', '/parent', '/']) expect(await guardRoute(to(path), spy, () => false, () => true)).toBe('/phone');
    expect(await guardRoute(to('/phone'), spy, () => false, () => true)).toBe(true);
    expect(await guardRoute(to('/home'), spy, () => true, () => true)).toBe(false);
    expect(entryState).not.toHaveBeenCalled();
    expect(choose).not.toHaveBeenCalled();
    expect(await guardRoute(to('/phone'), spy, () => false, () => false)).toBe('/home');
  });
});
