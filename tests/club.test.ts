/**
 * Клуб v2 (спека 019, Т3, design §2, §2.1, §2.2): город, подсказки с переводом раскладки, «Придумать» без города,
 * новый клуб, правка, починка поля сохранения, соперник Двора, тренер. Движок — чистые функции, без Vue и DOM.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reactive } from 'vue';
import { coachData, createClubNow, createClubOn, createClubTx, editClubNow, editClubTx, markNewsSeenNow, markNewsSeenTx } from '../src/app/club/club';
import {
  AFTER_START,
  FIRST_RUN_EXTRA,
  FIRST_RUN_STEPS,
  checkDraft,
  finishFirstRun,
  firstRunDraft,
  needsClub,
  resetDraft,
  startAt,
  startGuard,
  stepAfter,
  stepBefore,
} from '../src/app/firstRun/firstRun';
import { activeId } from '../src/app/players/active';
import { readSection } from '../src/app/save/sections';
import { clubData } from '../src/app/kits';
import { saveStore } from '../src/app/save/instance';
import { APP_VERSION } from '../src/app/version';
import { section as clubSection } from '../src/engine/club/save';
import clubsJson from '../src/content/clubs.json';
import coachJson from '../src/content/coach.json';
import keyboardJson from '../src/content/keyboard.json';
import { parseCoachData, coachOf, defaultCoach } from '../src/engine/coach/coach';
import {
  DEFAULT_KIT,
  checkCity,
  createClub,
  editClub,
  emptyClub,
  hasClub,
  markNewsSeen,
  repairClub,
  cityChips,
  suggestCities,
  suggestClubName,
  toRu,
  type ClubFields,
} from '../src/engine/club/create';
import { parseStreets, yardRival } from '../src/engine/club/rival';
import { kitsDiffer } from '../src/engine/club/kit';
import { parseKeymap } from '../src/engine/keymap';
import { ru } from '../src/i18n/ru';
import { twoTabs } from './saveFixtures';

const map = parseKeymap(keyboardJson);
const cities = clubData.cities;
const kit = { pattern: 'plain', body: '#c8102e', sleeves: '#ffffff', trim: '#16161a' } as const;
const draft = { name: 'Гром', kit, city: 'Тверь' };

describe('город (design §2.1, К6)', () => {
  it('принимает 2–24 знака, исправляет первую букву; отказы дают свой код', () => {
    // Ловит: сдвиг границ 2/24 (Петропавловск-Камчатский — ровно 24), потерю заглавной, лишний/пропущенный код отказа.
    expect(checkCity('Тверь')).toEqual({ ok: true, city: 'Тверь' });
    expect(checkCity('  тверь ')).toEqual({ ok: true, city: 'Тверь' });
    expect(checkCity('Петропавловск-Камчатский')).toEqual({ ok: true, city: 'Петропавловск-Камчатский' });
    expect(checkCity('Петропавловск-Камчатский!')).toMatchObject({ ok: false });
    expect(checkCity('Петропавловск-Камчатскийй')).toEqual({ ok: false, error: 'long' });
    expect(checkCity('У')).toEqual({ ok: false, error: 'short' });
    expect(checkCity('   ')).toEqual({ ok: false, error: 'short' });
    expect(checkCity('Тв@рь')).toEqual({ ok: false, error: 'chars' });
    expect(checkCity('Нижний  Новгород')).toEqual({ ok: false, error: 'spaces' });
    expect(checkCity('12')).toEqual({ ok: false, error: 'noLetters' });
    expect(checkCity('--')).toEqual({ ok: false, error: 'noLetters' });
  });

  it('латиница без кириллицы — layout (забыта русская раскладка), смесь — принимается', () => {
    // Ловит: «Ndthm» принят как город (В1) или отвергнут как chars; смесь с цифрой/латиницей не должна быть layout.
    expect(checkCity('Ndthm')).toEqual({ ok: false, error: 'layout' });
    expect(checkCity('Tver 2')).toEqual({ ok: false, error: 'layout' });
    expect(checkCity('Тверь 2')).toMatchObject({ ok: true });
    expect(checkCity('Тверь-A')).toMatchObject({ ok: true });
  });

  it('toRu переводит клавиши латиницы в русские знаки с регистром', () => {
    // Ловит: потерю регистра (Shift), неверный перевод клавиши, порчу знаков без пары.
    expect(toRu(map, 'ndthm')).toBe('тверь');
    expect(toRu(map, 'Ndthm')).toBe('Тверь');
    expect(toRu(map, 'cthgeayjd')).toBe('серпуфнов');
    expect(toRu(map, '7')).toBe('7');
  });

  it('подсказки: ndthm → Тверь первой, Ё = Е, не больше 5, точное совпадение первым', () => {
    // Ловит: нет перевода раскладки (В1), Ё ≠ Е («орел» не находит Орёл), >5 подсказок, точное не первым.
    expect(suggestCities(cities, 'ndthm', map)[0]).toBe('Тверь');
    expect(suggestCities(cities, 'Ndthm', map)[0]).toBe('Тверь');
    expect(suggestCities(cities, 'орел')).toEqual(['Орёл']);
    expect(suggestCities(cities, 'Орёл')).toEqual(['Орёл']);
    expect(suggestCities(['Ка', 'Ке', 'Ки', 'Ко', 'Ку', 'Ки-1', 'Ку-2'], 'к')).toHaveLength(5);
    expect(suggestCities(['Курск', 'Курган', 'Кур'], 'кур')[0]).toBe('Кур');
    expect(suggestCities(cities, 'яяяя', map)).toEqual([]);
  });

  it('чипы городов: пустое поле и готовый город — 8 чипов, по введённому — совпадения (019-Р40)', () => {
    // Ловит: один чип при «Выбери город из списка» (ребёнок-критик); чужие города при частичном вводе; точный город не первым.
    expect(cityChips(cities, '')).toEqual(cities.slice(0, 8));
    const ready = cityChips(cities, 'Тверь');
    expect(ready).toHaveLength(8);
    expect(ready[0]).toBe('Тверь');
    expect(new Set(ready).size).toBe(8);
    expect(cityChips(cities, 'ndthm', map)[0]).toBe('Тверь');
    expect(cityChips(['Курск', 'Курган', 'Кызыл'], 'кур')).toEqual(['Курск', 'Курган']);
    expect(cityChips(cities, 'яяяя', map)).toEqual([]);
    expect(cityChips(['К1', 'К2', 'К3', 'К4', 'К5', 'К6', 'К7', 'К8', 'К9'], 'к')).toHaveLength(8);
  });

  it('пустой запрос — первые 5 из списка; слово после дефиса и пробела находится', () => {
    // Ловит: пустой запрос без подсказок, поиск только по началу названия, регистрозависимость.
    expect(suggestCities(cities, '')).toEqual(cities.slice(0, 5));
    expect(suggestCities(cities, '   ')).toEqual(cities.slice(0, 5));
    const list = ['Петропавловск-Камчатский', 'Нижний Новгород', 'Омск'];
    expect(suggestCities(list, 'кам')).toEqual(['Петропавловск-Камчатский']);
    expect(suggestCities(list, 'НОВ')).toEqual(['Нижний Новгород']);
    expect(suggestCities(list, 'ов')).toEqual([]);
  });

  it('«Придумать» не дописывает город и не повторяет слова из поля', () => {
    // Ловит: возврат v1 `suggestName` с городом («Метеор Курган» у клуба из Твери), слово из поля, нестабильность зерна.
    for (let seed = 1; seed <= 200; seed++) {
      const name = suggestClubName(clubData, 'Прогресс', seed);
      expect(clubData.words, name).toContain(name);
      expect(name).not.toBe('Прогресс');
      expect(suggestClubName(clubData, 'Прогресс', seed)).toBe(name);
    }
  });
});

describe('запись клуба (design §2, Р2, Р11)', () => {
  const opts = { now: 1_700_000_000_000, coach: 'young', version: '2.0.0' };

  it('createClub: все поля, createdAt = max(1, now); существующий клуб не перезаписывается', () => {
    // Ловит: createdAt 0 при now = 0/NaN (клуба «нет»), затирание клуба из другой вкладки, потерю newsSeen/coach.
    const c = createClub(emptyClub(), draft, opts);
    expect(c).toEqual({ ...draft, coach: 'young', rival: '', createdAt: opts.now, newsSeen: '2.0.0' });
    expect(hasClub(c)).toBe(true);
    expect(createClub(emptyClub(), draft, { ...opts, now: 0 }).createdAt).toBe(1);
    expect(createClub(emptyClub(), draft, { ...opts, now: Number.NaN }).createdAt).toBe(1);
    const other = createClub(emptyClub(), { ...draft, name: 'Метеор' }, opts);
    expect(createClub(other, draft, { ...opts, now: 5 })).toBe(other);
    expect(hasClub(emptyClub())).toBe(false);
  });

  it('editClub меняет три поля и ничего больше', () => {
    // Ловит: правка, затирающая тренера, соперника, дату создания или отметку «что нового».
    const c: ClubFields = { ...createClub(emptyClub(), draft, opts), coach: 'veteran', rival: 'Метеор', newsSeen: '2.1.0' };
    const e = editClub(c, { name: 'Волна', kit: DEFAULT_KIT, city: 'Пермь' });
    expect(e).toEqual({ ...c, name: 'Волна', kit: DEFAULT_KIT, city: 'Пермь' });
  });

  it('markNewsSeen идёт только вперёд, по числам, битая версия игнорируется', () => {
    // Ловит: сравнение строк (0.10.0 < 0.9.0), откат отметки назад, запись мусора.
    const c = createClub(emptyClub(), draft, { ...opts, version: '0.9.0' });
    expect(markNewsSeen(c, '0.10.0').newsSeen).toBe('0.10.0');
    const d = markNewsSeen(c, '2.0.0');
    expect(markNewsSeen(d, '0.10.0')).toBe(d);
    expect(markNewsSeen(d, 'abc')).toBe(d);
  });

  it('испорченное createdAt при живом имени — клуб цел (createdAt = 1); пустое — клуба нет (В2)', () => {
    // Ловит: потерю клуба при мусоре в createdAt (первый запуск повторится и затрёт имя и цвета).
    const r = repairClub({ name: 'Гром', createdAt: 'x' });
    expect(r.club).toMatchObject({ name: 'Гром', createdAt: 1 });
    expect(r.repaired).toBe(true);
    expect(hasClub(r.club)).toBe(true);
    expect(repairClub({ city: 'Тверь', createdAt: -5 }).club).toMatchObject({ city: 'Тверь', createdAt: 1 });
    expect(hasClub(repairClub({ name: '', city: '', createdAt: 0 }).club)).toBe(false);
    expect(hasClub(repairClub({ name: 'Гром', createdAt: 0 }).club)).toBe(true);
    expect(hasClub(repairClub(null).club)).toBe(false);
    expect(hasClub(repairClub({ createdAt: 500 }).club)).toBe(true);
  });

  it('repairClub: имя режется до 20, битые цвета/город/версия заменяются, целое не трогается', () => {
    // Ловит: длинное имя на экране, исключение на битых цветах, город вне правил, newsSeen '' (строки v1 в v2).
    const long = repairClub({ ...draft, name: 'А'.repeat(30), createdAt: 7, newsSeen: '2.0.0', coach: '', rival: '' });
    expect(long.club.name).toBe('А'.repeat(20));
    const bad = repairClub({ name: 'Гром', kit: { body: 'red' }, city: 'Ndthm', createdAt: 7, newsSeen: 'x' }).club;
    expect(bad.kit).toEqual(DEFAULT_KIT);
    expect(bad.city).toBe('');
    expect(bad.newsSeen).toBe('2.0.0');
    const whole = { name: 'Гром', kit: DEFAULT_KIT, city: 'Тверь', coach: 'young', rival: '', createdAt: 7, newsSeen: '2.0.0' };
    expect(repairClub(whole)).toEqual({ club: whole, repaired: false });
    expect(repairClub({ ...whole, coach: 'нет-такого' }).club.coach).toBe('нет-такого');
  });
});

describe('имена соперников и заголовки итога (017-Р32)', () => {
  it('ни одно имя соперника не равно заголовку итога: «Победа» на табло читалась как результат', () => {
    // Ловит: возврат слова «Победа» (и подобных заголовкам итога) в список имён — ребёнок видел «Победа 0 : 1 Энергия».
    const norm = (x: string): string => x.toLowerCase().replace(/[!.…\s]+$/u, '');
    const titles = new Set(
      [...Object.values(ru.match2Result.title), ...Object.values(ru.match.outcome), ru.match.passed, ru.match.final].map(norm),
    );
    expect(titles.has(norm('Победа!'))).toBe(true); // страж самого теста: заголовок «Победа!» в наборе есть
    for (const w of clubData.words) {
      expect(titles.has(norm(w)), w).toBe(false);
      for (const city of clubData.cities) expect(titles.has(norm(`${w} ${city}`)), `${w} ${city}`).toBe(false);
    }
  });
});

describe('соперник Двора (design §2.2, Р17)', () => {
  const streets = parseStreets(clubsJson);
  const nameOf = (s: string) => `Двор на ${s}`;
  const club = { city: 'Тверь', kit };

  it('улицы из content: много, без повторов; «Двор на Садовой» входит', () => {
    // Ловит: пустой/дублированный список улиц и потерю «Садовой» (имя из ТЗ-1.10).
    expect(streets.length).toBeGreaterThanOrEqual(20);
    expect(streets).toContain('Садовой');
    expect(() => parseStreets({ streets: ['Садовой', 'Садовой'] })).toThrow();
    expect(() => parseStreets({})).toThrow();
  });

  it('одно зерно — тот же соперник, город клуба, форма отличается от своей; пустой город — без города', () => {
    // Ловит: недетерминированность, чужой город, соперник в форме клуба ребёнка, шаблон не из i18n.
    const a = yardRival(clubData, streets, club, 42, nameOf);
    expect(yardRival(clubData, streets, club, 42, nameOf)).toEqual(a);
    expect(a.name).toBe(`Двор на ${a.street}`);
    expect(streets).toContain(a.street);
    expect(a.city).toBe('Тверь');
    for (let seed = 0; seed < 40; seed++) {
      expect(kitsDiffer(yardRival(clubData, streets, club, seed, nameOf).kit, kit), String(seed)).toBe(true);
    }
    expect(yardRival(clubData, streets, { ...club, city: '' }, 42, nameOf).city).toBe('');
    const seen = new Set(Array.from({ length: 60 }, (_, i) => yardRival(clubData, streets, club, i, nameOf).street));
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe('тренер (design §2, Р12)', () => {
  const data = parseCoachData(coachJson);

  it('content: 4 облика 020, по умолчанию young, у каждого имя и приветствие', () => {
    // Ловит: id, не совпадающие с обликами 020, пустой greet, default вне списка.
    expect(data.coaches.map((c) => c.id)).toEqual(['young', 'veteran', 'ponytail', 'bigbeard']);
    expect(defaultCoach(data).id).toBe('young');
    expect(() => parseCoachData({ ...coachJson, default: 'x' })).toThrow();
    expect(() => parseCoachData({ ...coachJson, coaches: [...coachJson.coaches, coachJson.coaches[0]] })).toThrow();
    expect(() => parseCoachData({ default: 'a', coaches: [{ id: 'a', name: 'А', greet: '' }] })).toThrow();
  });

  it('незнакомый и пустой id показывают тренера по умолчанию, знакомый — своего', () => {
    // Ловит: исключение или пустой пузырь у клуба с неизвестным тренером.
    expect(coachOf(data, 'veteran').id).toBe('veteran');
    expect(coachOf(data, '').id).toBe('young');
    expect(coachOf(data, 'zzz').id).toBe('young');
  });
});

describe('запись клуба в сохранение (019-Т5, К10, design §2)', () => {
  type Tabs = ReturnType<typeof twoTabs>;
  const o = { now: 1_700_000_000_000, coach: 'young', version: '0.10.1' };
  const lyingClub = (t: Tabs): ClubFields =>
    (JSON.parse(t.data.get(t.key) ?? 'null') as { sections: { club: ClubFields } }).sections.club;

  it('создание — одна запись со всеми полями; тренер по умолчанию, newsSeen = версия', () => {
    // Ловит: клуб двумя записями (имя отдельно от города), потерю coach/newsSeen, createdAt не из часов.
    const t = twoTabs();
    const before = t.state.writes;
    const res = t.a.updatePlayer((tx) => createClubTx(tx, draft, o));
    expect(res.created).toBe(true);
    expect(t.state.writes - before).toBe(1);
    expect(lyingClub(t)).toEqual({ ...draft, coach: 'young', rival: '', createdAt: o.now, newsSeen: '0.10.1' });
    expect(t.a.readSection(clubSection)).toEqual(lyingClub(t));
  });

  it('повторное создание (вторая вкладка уже создала) ничего не пишет и отдаёт лежащий', () => {
    // Ловит: «Готово» во второй вкладке затирает имя, форму и город, выбранные в первой (К10, 018-Р23).
    const t = twoTabs();
    t.a.updatePlayer((tx) => createClubTx(tx, draft, o));
    t.b.store.load('p1');
    const writes = t.state.writes;
    const res = t.b.updatePlayer((tx) => createClubTx(tx, { name: 'Волна', kit: DEFAULT_KIT, city: 'Пермь' }, { ...o, now: 9 }));
    expect(res.created).toBe(false);
    expect(res.club).toMatchObject({ name: 'Гром', city: 'Тверь', createdAt: o.now });
    expect(t.state.writes).toBe(writes);
    expect(lyingClub(t).name).toBe('Гром');
  });

  it('createdAt = max(1, now): время-мусор не превращает созданный клуб в «клуба нет»', () => {
    // Ловит: createdAt = 0 при now = 0 / NaN — первый запуск повторился бы, имя затёрлось.
    for (const now of [0, Number.NaN, -5]) {
      const t = twoTabs();
      const res = t.a.updatePlayer((tx) => createClubTx(tx, draft, { ...o, now }));
      expect(res.created, String(now)).toBe(true);
      expect(lyingClub(t).createdAt, String(now)).toBe(1);
      expect(hasClub(t.a.readSection(clubSection))).toBe(true);
    }
  });

  it('правка меняет три поля поверх чужой записи: тренер, соперник, дата и «что нового» остаются', () => {
    // Ловит: правка по памяти вкладки — стирает то, что вторая вкладка записала между чтением и записью.
    const t = twoTabs();
    t.a.updatePlayer((tx) => createClubTx(tx, draft, o));
    t.b.store.load('p1');
    t.b.updatePlayer((tx) => markNewsSeenTx(tx, '2.1.0'));
    t.a.updatePlayer((tx) => editClubTx(tx, { name: 'Волна', kit: DEFAULT_KIT, city: 'Пермь' }));
    expect(lyingClub(t)).toEqual({
      name: 'Волна', kit: DEFAULT_KIT, city: 'Пермь', coach: 'young', rival: '', createdAt: o.now, newsSeen: '2.1.0',
    });
  });

  it('markNewsSeen не идёт назад; без изменений — без записи', () => {
    // Ловит: откат отметки «что нового» старой версией (строки v1 всплывут снова) и лишние записи.
    const t = twoTabs();
    t.a.updatePlayer((tx) => createClubTx(tx, draft, { ...o, version: '2.0.0' }));
    t.a.updatePlayer((tx) => markNewsSeenTx(tx, '2.1.0'));
    const writes = t.state.writes;
    t.a.updatePlayer((tx) => markNewsSeenTx(tx, '0.10.0'));
    t.a.updatePlayer((tx) => markNewsSeenTx(tx, 'мусор'));
    expect(t.state.writes).toBe(writes);
    expect(lyingClub(t).newsSeen).toBe('2.1.0');
  });

  it('createClubNow: тренер из coach.json и версия сборки; второй вызов не затирает', () => {
    // Ловит: тренер не из контента, newsSeen не APP_VERSION, затирание клуба повторным «Готово» (двойной клик).
    saveStore.create('t5');
    const first = createClubNow(draft, { player: 't5', now: 77 });
    expect(first.created).toBe(true);
    expect(first.blocked).toBe(false);
    expect(first.club).toMatchObject({ ...draft, coach: defaultCoach(coachData).id, createdAt: 77, newsSeen: APP_VERSION });
    const second = createClubNow({ ...draft, name: 'Волна' }, { player: 't5', now: 99 });
    expect(second).toMatchObject({ created: false, blocked: false });
    expect(saveStore.memory('t5')?.club).toMatchObject({ name: 'Гром', createdAt: 77 });
  });

  it('только чтение (newer): «Готово» не создаёт клуб — blocked, лежащий клуб пуст, записей нет', () => {
    // Ловит: ложное «создано» при вхолостую посчитанной записи — ребёнок ушёл бы на карту без клуба, с «клубом» только на экране.
    const t = twoTabs();
    const newer = { ...(JSON.parse(t.data.get(t.key) ?? '') as object), format: 999 };
    t.data.set(t.key, JSON.stringify(newer));
    t.a.updatePlayer((tx) => tx.get(clubSection));
    expect(t.a.canWrite()).toBe(false);
    const text = t.data.get(t.key);
    const writes = t.state.writes;
    const res = createClubOn((fn) => t.a.updatePlayer(fn), () => t.a.readSection(clubSection), draft, o);
    expect(res).toMatchObject({ created: false, blocked: true });
    expect(res.club.createdAt).toBe(0);
    expect(hasClub(res.club)).toBe(false);
    expect(t.state.writes).toBe(writes);
    expect(t.data.get(t.key)).toBe(text);
  });

  it('игрок удалён в другой вкладке: «Готово» — blocked, записи нет', () => {
    // Ловит: клуб «создан» для игрока, которого уже нет (запись отброшена слоем сохранения, а экран пошёл дальше).
    const t = twoTabs();
    t.a.store.create('p2');
    t.a.store.setHasPlayer((id) => id !== 'p2');
    t.data.delete(t.key.replace('p1', 'p2'));
    const writes = t.state.writes;
    const res = createClubOn(
      (fn) => t.a.updatePlayer(fn, { player: 'p2' }),
      () => (t.a.store.memory('p2')?.club as ClubFields | undefined) ?? emptyClub(),
      draft,
      o,
    );
    expect(res).toMatchObject({ created: false, blocked: true });
    expect(res.club.createdAt).toBe(0);
    expect(t.state.writes).toBe(writes);
    expect(t.data.has(t.key.replace('p1', 'p2'))).toBe(false);
  });

  it('createClubOn на живом хранилище: created, не blocked; клуб лежит', () => {
    // Ловит: blocked на здоровой записи (кнопка «Готово» не пускала бы дальше никогда).
    const t = twoTabs();
    const res = createClubOn((fn) => t.a.updatePlayer(fn), () => t.a.readSection(clubSection), draft, o);
    expect(res).toMatchObject({ created: true, blocked: false });
    expect(lyingClub(t).createdAt).toBe(o.now);
  });

  it('реактивный черновик экрана (Proxy Vue) пишется: создать и править', () => {
    // Ловит: DataCloneError на «Готово» — structuredClone слоя не берёт Proxy (браузер 08.11, экран сбоя вместо карты).
    const t = twoTabs();
    const live = reactive(JSON.parse(JSON.stringify(draft)) as typeof draft);
    const res = createClubOn((fn) => t.a.updatePlayer(fn), () => t.a.readSection(clubSection), live, o);
    expect(res).toMatchObject({ created: true, blocked: false });
    expect(() => t.a.updatePlayer((tx) => editClubTx(tx, live))).not.toThrow();
  });
});

describe('экраны первого запуска (019-Т5, К7, К8, В8)', () => {
  it('до первой печати не больше 6 экранов: шаги + дополнительные + карта + вступление', () => {
    // Ловит: лишний шаг первого запуска или комикс 039 сверх бюджета ТЗ-10.10 (e2e `npm run check` не гоняет).
    const screens = FIRST_RUN_STEPS.length + FIRST_RUN_EXTRA.length + 1 + 1;
    expect(screens).toBeLessThanOrEqual(6);
    expect(FIRST_RUN_STEPS).toEqual(['card', 'club', 'city']);
  });

  it('клуб нужен, пока createdAt = 0; битое имя клуб не отменяет', () => {
    // Ловит: охрана гоняет на /start ребёнка, у которого клуб есть (createdAt ≥ 1), или пускает на карту без клуба.
    expect(needsClub(emptyClub())).toBe(true);
    expect(needsClub({ createdAt: 1 })).toBe(false);
    expect(needsClub(repairClub({ name: 'Гром', createdAt: 'x' }).club)).toBe(false);
  });

  it('checkDraft: имя и город приводятся; первая ошибка называет поле', () => {
    // Ловит: запись непроверенного черновика (латиница в городе, пустое имя), потерю заглавной буквы города.
    expect(checkDraft({ ...draft, name: '  Гром ', city: ' тверь' })).toEqual({ ok: true, draft });
    expect(checkDraft({ ...draft, name: '' })).toEqual({ ok: false, field: 'name', error: 'short' });
    expect(checkDraft({ ...draft, city: 'Ndthm' })).toEqual({ ok: false, field: 'city', error: 'layout' });
    expect(checkDraft({ ...draft, name: '', city: 'Ndthm' })).toMatchObject({ field: 'name' });
  });

  it('черновик живёт в памяти и сбрасывается; по умолчанию — первая палитра, город пуст, название — готовый вариант', () => {
    // Ловит: черновик, переживший вход на /start (чужое имя у нового ребёнка), и пустое поле названия (ребёнок с пустого листа).
    resetDraft(1, draft);
    expect(firstRunDraft).toEqual(draft);
    resetDraft(1);
    expect(firstRunDraft.kit).toEqual(clubData.palettes[0]);
    expect(firstRunDraft.city).toBe('');
    expect(clubData.words).toContain(firstRunDraft.name);
    expect(firstRunDraft.name).toBe(suggestClubName(clubData, '', 1));
  });

  it('клуб, первый запуск и форма не импортируют ключи и хранилище v1 (К8)', () => {
    // Ловит: новый клуб, пишущий в `keykick.*` через app/storage или прогресс v1 (мажор ≤ 1 писал бы клуб в память).
    const dirs = ['src/app/club', 'src/app/firstRun', 'src/components/club', 'src/engine/club'];
    const files = dirs.flatMap((d) => readdirSync(d).map((f) => join(d, f)));
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const f of files) {
      const imports = [...readFileSync(f, 'utf8').matchAll(/from\s+'([^']+)'/g)].map((m) => m[1] ?? '');
      expect(imports.filter((s) => /\/(storage|players\/active|versions\/build)$/.test(s)), f).toEqual([]);
    }
  });

  it('шаги: вперёд и назад по FIRST_RUN_STEPS; на краях — null', () => {
    // Ловит: Esc на карточке уводит «назад» из экрана (ломает первый запуск), «Дальше» на городе не пишет клуб.
    expect(stepAfter('card')).toBe('club');
    expect(stepAfter('club')).toBe('city');
    expect(stepAfter('city')).toBeNull();
    expect(stepBefore('city')).toBe('club');
    expect(stepBefore('club')).toBe('card');
    expect(stepBefore('card')).toBeNull();
  });

  it('?at= работает только в dev и только с известным шагом; без него — карточка', () => {
    // Ловит: образец в выпуске (ребёнок по чужой ссылке пропускает карточку) и падение на мусорном `at`.
    expect(startAt({ at: 'city' }, true)).toEqual({ step: 'city', sample: true });
    expect(startAt({ at: 'city' }, false)).toEqual({ step: 'card', sample: false });
    expect(startAt({ at: 'zzz' }, true)).toEqual({ step: 'card', sample: false });
    expect(startAt({}, true)).toEqual({ step: 'card', sample: false });
    expect(startAt(null, true)).toEqual({ step: 'card', sample: false });
  });

  it('finishFirstRun: ошибка названия — на шаг клуба, города — остаёмся, записи нет', () => {
    // Ловит: запись клуба с пустым названием или латиницей в городе; «Готово» без возврата к больному полю.
    saveStore.create('t6a');
    expect(finishFirstRun({ ...draft, name: '' }, { now: 5, player: 't6a' })).toEqual({ to: 'step', step: 'club' });
    expect(finishFirstRun({ ...draft, city: 'Ndthm' }, { now: 5, player: 't6a' })).toEqual({ to: 'step', step: 'city' });
    expect(hasClub((saveStore.memory('t6a')?.club as ClubFields | undefined) ?? emptyClub())).toBe(false);
  });

  it('finishFirstRun: клуб пишется одной записью; повтор (двойной клик, другая вкладка) — тоже next и не затирает', () => {
    // Ловит: «Готово» дважды создаёт два клуба или падает; повтор из другой вкладки возвращает на /start.
    saveStore.create('t6b');
    expect(finishFirstRun({ ...draft, name: ' Гром ' }, { now: 11, player: 't6b' })).toEqual({ to: 'next' });
    expect(saveStore.memory('t6b')?.club).toMatchObject({ name: 'Гром', city: 'Тверь', createdAt: 11 });
    expect(finishFirstRun({ ...draft, name: 'Волна' }, { now: 12, player: 't6b' })).toEqual({ to: 'next' });
    expect(saveStore.memory('t6b')?.club).toMatchObject({ name: 'Гром', createdAt: 11 });
  });

  it('finishFirstRun: запись не вышла (blocked) — экран 014, а не круг на /start; создана другой вкладкой — next', () => {
    // Ловит: 019-Р19 — «Готово» вхолостую считалась успехом, и ребёнка гоняло /start ↔ карта (сама запись — в тестах createClubOn).
    const stub = (blocked: boolean): typeof createClubNow => () => ({ club: emptyClub(), created: false, blocked });
    expect(finishFirstRun(draft, { now: 5 }, stub(true))).toEqual({ to: 'blocked' });
    expect(finishFirstRun(draft, { now: 5 }, stub(false))).toEqual({ to: 'next' });
  });

  it('охрана /start: нет клуба — пускает; клуб есть — на AFTER_START; образец dev проходит с клубом', () => {
    // Ловит: ребёнок с клубом снова видит «Новый клуб» (затирает свой); образец быстрой проверки уводится с экрана.
    const id = activeId();
    expect(id).not.toBeNull();
    expect(hasClub(readSection(clubSection))).toBe(false);
    expect(startGuard({ query: {} }, false)).toBe(true);
    createClubNow(draft, { now: 21 });
    expect(hasClub(readSection(clubSection))).toBe(true);
    expect(startGuard({ query: {} }, false)).toBe(AFTER_START);
    expect(startGuard({ query: { at: 'club' } }, false)).toBe(AFTER_START);
    expect(startGuard({ query: { at: 'club' } }, true)).toBe(true);
  });

  it('карта пишет клуб из компонента: reactive-правка и «Что нового» не роняют запись (DataCloneError)', () => {
    // Ловит: Proxy Vue в editClubNow/markNewsSeenNow — structuredClone слоя его не берёт, карта показала бы экран сбоя.
    createClubNow(draft, { now: 21 });
    const live = reactive({ name: 'Волна', kit: JSON.parse(JSON.stringify(draft.kit)) as typeof draft.kit, city: 'Омск' });
    const edited = editClubNow(live);
    expect(edited).toMatchObject({ name: 'Волна', city: 'Омск', createdAt: 21 });
    expect(readSection(clubSection)).toMatchObject({ name: 'Волна', city: 'Омск' });
    const seen = reactive({ version: '9.9.9' });
    expect(markNewsSeenNow(seen.version).newsSeen).toBe('9.9.9');
  });
});
