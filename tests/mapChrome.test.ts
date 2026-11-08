/**
 * Шапка, лист лиги, карточка места, «Что нового» и правка клуба на карте (спека 019-Т8): клавиатура шапки, адрес окон,
 * «Исправить», тексты карточек, переключение листа на уроке 17, монеты шапки. Подготовка — `mapHelpers.ts`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'vue/compiler-sfc';
import { describe, expect, it, vi } from 'vitest';
import { leagues } from '../src/app/course/load';
import { clubNeedsFix, overlayFromQuery } from '../src/app/map/chrome';
import { keyAction, type KeyContext } from '../src/app/map/keys';
import { collectProvided } from '../src/app/map/state';
import { saveContext } from '../src/app/save/instance';
import { registry } from '../src/app/save/registry';
import { pendingCard } from '../src/app/whatsNew';
import type { LockCond } from '../src/engine/map/lock';
import { isCupLater, lockLine, placeInfo, secondHalf, sheetLine, sheetRows } from '../src/components/map/labels';
import { applyV2Seed } from '../src/dev/seed2';
import { emptyClub, markNewsSeen } from '../src/engine/club/create';
import { buildMapModel, type MapInput } from '../src/engine/map/model';
import type { NewsEntry } from '../src/engine/news';
import { classify } from '../src/engine/save/format';
import { ru } from '../src/i18n/ru';
import { coinsOf } from '../src/engine/wallet/view';
import { mapInput, yardIds, yardLeague } from './mapHelpers';

// --- шапка, лист лиги, карточка места, «Что нового», правка клуба (Т8) ---------------------------------------

describe('шапка: вход с клавиатуры (ТЗ-0.16, 019-Р18)', () => {
  const m = buildMapModel(mapInput(yardIds([1, 2, 3])));
  const ctx = (over: Partial<KeyContext> = {}): KeyContext => ({
    from: 'header', active: 'building:museum', shift: false, repeat: false, cardOpen: true, exists: () => true, ...over,
  });

  it('Enter на кнопке шапки — её собственное нажатие, не «открыть карточку»', () => {
    // Ловит: preventDefault на Enter в шапке — «Путь клуба», «Клуб» и «Лист лиги» не нажать клавиатурой.
    expect(keyAction(m, 'Enter', ctx())).toEqual({ do: 'native' });
    expect(keyAction(m, 'Enter', ctx({ cardOpen: false }))).toEqual({ do: 'native' });
  });

  it('Tab с последнего здания — на шапку; Shift+Tab с шапки — обратно на здание; Tab с шапки уходит из карты', () => {
    // Ловит: ловушка фокуса (шапка зациклена на карту) и недостижимая шапка.
    expect(keyAction(m, 'Tab', ctx({ from: 'building:museum' }))).toEqual({ do: 'focus', id: 'header' });
    expect(keyAction(m, 'Tab', ctx({ shift: true }))).toEqual({ do: 'focus', id: 'building:museum' });
    expect(keyAction(m, 'Tab', ctx())).toEqual({ do: 'native' });
  });
});

describe('окна поверх карты: адрес и «Исправить»', () => {
  it('?sheet|news=1 открывают окно только в dev-сборке, ?edit=1 — и в выпуске (пункт меню «Клуб»)', () => {
    // Ловит: лист или «Что нового» по адресу в выпуске (кадры не должны менять игру ребёнка); меню «Клуб», не открывающее правку.
    expect(overlayFromQuery({ sheet: '1' }, true)).toBe('sheet');
    expect(overlayFromQuery({ news: '' }, true)).toBe('news');
    expect(overlayFromQuery({ edit: '1' }, true)).toBe('edit');
    expect(overlayFromQuery({ sheet: '1', edit: '1' }, true)).toBe('sheet');
    expect(overlayFromQuery({ sheet: '1', news: '1', edit: '1' }, false)).toBe('edit');
    expect(overlayFromQuery({ edit: '1' }, false)).toBe('edit');
    expect(overlayFromQuery({ sheet: '1' }, false)).toBeNull();
    expect(overlayFromQuery({ news: '' }, false)).toBeNull();
    expect(overlayFromQuery({ focus: 'yard-02' }, true)).toBeNull();
  });

  it('«Исправить» вместо «Клуб»: нет названия или нет города; целому клубу — «Клуб»', () => {
    // Ловит: порча имени или города (018, «Исправить») не видна на карте, ребёнок не может её поправить.
    expect(clubNeedsFix({ name: 'Прогресс', city: 'Тверь' })).toBe(false);
    expect(clubNeedsFix({ name: '', city: 'Тверь' })).toBe(true);
    expect(clubNeedsFix({ name: '  ', city: 'Тверь' })).toBe(true);
    expect(clubNeedsFix({ name: 'Прогресс', city: '' })).toBe(true);
  });
});

describe('карточка места (флажок, здание, ворота)', () => {
  const info = (passed: number[], id: string, over: Partial<MapInput> = {}) =>
    placeInfo(buildMapModel(mapInput(yardIds(passed), over)), id, { cup: yardLeague.cup, nextLeague: leagues[1]!.name });

  it('флажок: «после урока N», ближайший — отметка; кубка ещё нет — «появится в следующих версиях» и до урока 9 (019-Р46)', () => {
    // Ловит: карточка флажка без номера урока; «Ближайший кубок» не у ближайшего флажка; «Откроется на уроке 9» у кубка,
    // которого в игре нет (в уроке 9 откроется пустота).
    const later = 'Кубок двора появится в следующих версиях игры';
    const near = info([1, 2, 3], 'flag:9')!;
    expect(near).toMatchObject({ kind: 'flag', title: yardLeague.cup });
    expect(near.lines).toEqual(['после урока 9', 'Ближайший кубок', later]);
    expect(info([1, 2, 3], 'flag:14')!.lines).toEqual(['после урока 14', later]);
  });

  it('isCupLater: флажок без поставщика — «позже»; с поставщиком (любой замок и подсказка) — нет', () => {
    // Ловит: «появится в следующих версиях» у кубка, который поставщик (Э5) уже даёт; условие по виду замка вместо отметки модели.
    const flags = (over: Partial<MapInput> = {}) => buildMapModel(mapInput(yardIds([1]), over)).flags;
    expect(flags().every((f) => isCupLater(f))).toBe(true);
    const given = (lock: LockCond | null, hint: string | null) =>
      collectProvided({ '../a/mapProvide.ts': { provide: { cup: () => ({ lock, hint }) } } });
    for (const [lock, hint] of [[{ soon: true }, null], [{ lesson: 9 }, null], [{ matches: 2 }, null], [null, 'Сетка кубка']] as const) {
      expect(flags({ provided: given(lock, hint) }).some((f) => isCupLater(f)), JSON.stringify(lock)).toBe(false);
    }
  });

  it('кубок после пройденного урока 9 — «появится в следующих версиях», а не «Скоро» (019-Р36)', () => {
    // Ловит: «Скоро» у кубка, до которого игрок уже дошёл: ребёнок решает, что сломалось.
    const later = info(Array.from({ length: 9 }, (_, i) => i + 1), 'flag:9')!;
    expect(later.lines.at(-1)).toBe('Кубок двора появится в следующих версиях игры');
    expect(later.lines.join()).not.toContain('Скоро');
  });

  it('поставщик кубка: подсказка важнее замка; здание без поставщика — «Скоро»; стадион — следующий этап', () => {
    // Ловит: подсказка 037 («сетка») потеряна; у школы вместо «Скоро» пусто; у стадиона нет «Дальше».
    const provided = collectProvided({ '../a/mapProvide.ts': { provide: { cup: () => ({ lock: null, hint: 'Сетка кубка' }) } } });
    expect(info([1, 2, 3], 'flag:9', { provided })!.lines.at(-1)).toBe('Сетка кубка');
    expect(info([1], 'building:school')!).toMatchObject({ kind: 'building', title: 'Школа', lines: ['Скоро'] });
    expect(info([1], 'building:stadium')!.lines[0]).toMatch(/^Дальше: .+ — после урока \d+$/);
  });

  it('ворота: туман, «строится» при пройденном Дворе; незнакомый id — ничего', () => {
    // Ловит: ворота «открыты» при следующей лиге-заготовке (ТЗ-14.6); карточка у несуществующего места.
    expect(info([1], 'gate')).toMatchObject({ kind: 'gate', title: 'Ворота', lines: ['Ворота откроются, когда пройдёшь все уроки лиги'] });
    const done = Array.from({ length: 32 }, (_, i) => i + 1);
    expect(info(done, 'gate')!.lines[0]).toContain('строится');
    expect(info([1], 'yard-01')).toBeNull();
    expect(info([1], 'flag:99')).toBeNull();
  });
});

describe('лист лиги (ТЗ-1.8)', () => {
  const sheet = (passed: number[], stars: { got: number; max: number }) => {
    const m = buildMapModel(mapInput(yardIds(passed)));
    return sheetRows(stars, secondHalf(m.points));
  };
  const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  it('на уроке 16 — «сделано», на уроке 17 — «осталось»; все пройдены — «осталось»', () => {
    // Ловит: переключение не на середине лиги (на 17-м уроке Двора) и «сделано» в конце лиги.
    const first = sheet(range(15), { got: 23, max: 96 });
    expect(first[0]).toMatchObject({ id: 'stars', kind: 'done', n: 23, max: 96 });
    expect(sheetLine(first[0]!)).toBe('Сделано: 23 из 96');
    const second = sheet(range(16), { got: 23, max: 96 });
    expect(second[0]).toMatchObject({ kind: 'left', n: 73 });
    expect(sheetLine(second[0]!)).toBe('Ещё 73 звезды');
    expect(sheet(range(32), { got: 96, max: 96 })[0]).toMatchObject({ kind: 'left', n: 0 });
    expect(sheetLine(sheet(range(32), { got: 96, max: 96 })[0]!)).toBe('Все звёзды собраны');
    // Склонение: 1 звезда, 2 звезды, 5 звёзд, 21 звезда.
    expect([1, 2, 5, 21].map((n) => sheetLine({ id: 'stars', kind: 'left', n, max: 96 }))).toEqual(['Ещё 1 звезда', 'Ещё 2 звезды', 'Ещё 5 звёзд', 'Ещё 21 звезда']);
  });

  it('альбом, эмблема, права — одна строка вместо трёх «Скоро» (019-Р38); звёзды в зажиме 0…max', () => {
    // Ловит: возврат трёх пустых строк «Скоро»; выдуманные числа 22/24/26; отрицательное «осталось» при мусоре.
    expect(sheet(range(3), { got: 5, max: 96 })).toHaveLength(1);
    expect(sheetRows({ got: 120, max: 96 }, true)[0]!.n).toBe(0);
    expect(sheetRows({ got: -4, max: 96 }, false)[0]!.n).toBe(0);
  });
});

describe('«Что нового» на карте (ТЗ-12.12, К9)', () => {
  const list: NewsEntry[] = [
    { version: '2.1.0', date: '', kid: ['Новая лига'], parent: [] },
    { version: '2.0.0', date: '', kid: ['Новая игра'], parent: [] },
  ];

  it('новичок (отметка = версия при создании) не видит карточки; тот, кто не видел, видит раз — после закрытия карточки нет', () => {
    // Ловит: карточка новичку; повтор после закрытия (отметка не поставлена или идёт назад).
    const fresh = { ...emptyClub(), newsSeen: '2.1.0' };
    expect(pendingCard(list, fresh.newsSeen, '2.1.0')).toBeNull();
    const old = { ...emptyClub(), newsSeen: '2.0.0' };
    expect(pendingCard(list, old.newsSeen, '2.1.0')).toEqual({ version: '2.1', lines: ['Новая лига'] });
    const after = markNewsSeen(old, '2.1.0');
    expect(pendingCard(list, after.newsSeen, '2.1.0')).toBeNull();
    // Повторное закрытие и «показать ещё раз» не откатывают отметку назад.
    expect(markNewsSeen(after, '2.0.0').newsSeen).toBe('2.1.0');
  });

  it('у каждого игрока своя отметка: второй игрок с отметкой 2.0.0 увидит карточку, первый — нет', () => {
    // Ловит: общая отметка «видел» на всех игроков (спека 019-Р11).
    const first = markNewsSeen({ ...emptyClub(), newsSeen: '2.0.0' }, '2.1.0');
    const second = { ...emptyClub(), newsSeen: '2.0.0' };
    expect(pendingCard(list, first.newsSeen, '2.1.0')).toBeNull();
    expect(pendingCard(list, second.newsSeen, '2.1.0')).not.toBeNull();
  });
});

describe('монеты шапки (018-Р25)', () => {
  it('сид «середина» — 230 монет через показ wallet/view; мусор — 0', () => {
    // Ловит: шапка без монет или с чужим числом; мусор в разделе показывается как «NaN».
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k), key: (i: number) => [...data.keys()][i] ?? null, get length() { return data.size; },
    });
    applyV2Seed('v2-mid');
    vi.unstubAllGlobals();
    const d = classify([...data.entries()].find(([k]) => k.endsWith('save.p1'))?.[1] ?? null);
    if (d.kind !== 'ok') throw new Error('seed');
    const def = registry.find((x) => x.name === 'wallet')!;
    expect(coinsOf(def.parse(d.envelope.sections.wallet, saveContext) as Parameters<typeof coinsOf>[0])).toBe(230);
    expect(coinsOf(null)).toBe(0);
    expect(coinsOf({ coins: Number.NaN } as Parameters<typeof coinsOf>[0])).toBe(0);
  });
});


// --- склонение замка и «Старая версия» (019-Т14, К5, К8) ------------------------------------------------------

describe('замок «после ещё N матчей» (К5)', () => {
  it('lockLine: 1 и 21 — «одного», 2 — «нескольких», 5 — «многих»; число подставлено', () => {
    // Ловит: склонение, зашитое в одну форму (plural → matchesWord.many): «ещё 1 матчей», «ещё 21 матчей».
    const w = ru.map.lock.matchesWord;
    const line = (n: number, word: string) => ru.map.lock.matches.replace('{n}', String(n)).replace('{w}', word);
    expect(lockLine({ matches: 1 })).toBe(line(1, w.one));
    expect(lockLine({ matches: 2 })).toBe(line(2, w.few));
    expect(lockLine({ matches: 5 })).toBe(line(5, w.many));
    expect(lockLine({ matches: 21 })).toBe(line(21, w.one));
    expect(w.one).not.toBe(w.many);
  });
});

describe('«Старая версия» открывается в новой вкладке (К8)', () => {
  /** Ссылки шаблона .vue с :href="oldUrl": узлы разбора SFC (монтировать нельзя — окружение node без плагина Vue). */
  function oldLinks(file: string): { target: string | undefined; rel: string | undefined }[] {
    const ast = parse(readFileSync(join(__dirname, '..', file), 'utf8')).descriptor.template?.ast;
    const found: { target: string | undefined; rel: string | undefined }[] = [];
    const walk = (node: { children?: unknown[]; tag?: string; props?: { name: string; value?: { content: string }; arg?: { content: string }; exp?: { content: string } }[] }): void => {
      if (node.tag === 'a' && node.props?.some((p) => p.name === 'bind' && p.arg?.content === 'href' && p.exp?.content === 'oldUrl')) {
        const attr = (name: string) => node.props?.find((p) => p.name === name)?.value?.content;
        found.push({ target: attr('target'), rel: attr('rel') });
      }
      for (const c of node.children ?? []) if (typeof c === 'object' && c !== null) walk(c);
    };
    if (ast) walk(ast);
    return found;
  }

  it.each(['src/screens/map/MapScreen.vue', 'src/components/firstRun/NewSeasonCard.vue'])('%s: ссылка на старую версию — target=_blank и rel с noopener', (file) => {
    // Ловит: _blank → _self (игрок уходит с карты и теряет открытую страницу), потерю rel=noopener.
    const links = oldLinks(file);
    expect(links).toHaveLength(1);
    expect(links[0]?.target).toBe('_blank');
    expect(links[0]?.rel).toContain('noopener');
  });
});
