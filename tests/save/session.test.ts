/**
 * Мост сохранения к Vue (063-Р5, К8): `session.ts` на хранилище в памяти. Другая подготовка, чем у `storage.test.ts`:
 * сеанс поверх готового `Store`. У каждого теста строка «Ловит:».
 */
import { isReactive, reactive } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { saveClubFile } from '../../src/app/save/exportFile';
import { SECTIONS } from '../../src/app/save/sections';
import { channelOf, plain } from '../../src/app/save/session';
import { PALETTES, clubFromDraft, defaultDraft, playerNameOf } from '../../src/engine/club/start';
import { MAX_PLAYERS, enter } from '../../src/engine/players/entry';
import { createPlayer } from '../../src/engine/save/envelope';
import { FOREIGN, P } from '../fixtures/storageKit';
import { browser, disk, rev, withClub } from '../fixtures/sessionKit';

// Скачивание подменено: что ушло бы в файл, оседает в `downloaded`.
const downloaded: string[] = [];
vi.mock('../../src/app/parent/download', () => ({
  saveTextFile: (_name: string, text: string): boolean => {
    downloaded.push(text);
    return true;
  },
}));

describe('session: разделы сборки и запись (К8)', () => {
  it('К8: реестр — club, course:ru, seen, wallet, day, school, form; новый игрок целиком годен, шаги `up` есть до текущей версии', () => {
    // Ловит: раздел забыт в реестре (его нет в сохранении) или поднят до `v` без шага `up`.
    expect(SECTIONS.map((d) => d.name)).toEqual(['club', 'course:ru', 'seen', 'wallet', 'day', 'school', 'form', 'stadium']);
    for (const d of SECTIONS) for (let k = 2; k <= d.v; k++) expect(typeof d.up[k]).toBe('function');
    for (const d of SECTIONS) expect(d.check(d.empty())).toEqual([]);
    expect(createPlayer({ pid: 'a', name: 'А' }, SECTIONS).sections['seen']!.v).toBe(1);
  });

  it('К8: первый запуск — устройство и игрок записаны, вкладка выбрала игрока, status ok', async () => {
    // Ловит: create не пишет устройство или игрока, не выбирает вкладку (Дом без игрока, З2).
    const { mem, tab } = browser();
    const { session } = tab();
    await session.init();
    expect(session.device.value.kind).toBe('absent');
    expect(session.entryState()).toMatchObject({ device: 'absent', players: [], player: 'none' });
    expect(await session.create({ name: 'Саша' })).toEqual({ ok: true, pid: 'p1' });
    expect(session.status.value).toBe('ok');
    expect(session.tabPid.value).toBe('p1');
    expect(session.entryState()).toEqual({ device: 'ok', players: ['p1'], tabPid: 'p1', player: 'ok' });
    expect(disk(mem, 'device').players).toEqual([{ pid: 'p1', order: 0 }]);
    expect(Object.keys(disk(mem, 'player.p1').sections).sort()).toEqual(['club', 'course:ru', 'day', 'form', 'school', 'seen', 'stadium', 'wallet']);
    for (const [k, v] of Object.entries(FOREIGN)) expect(mem.map.get(k)).toBe(v);
  });

  it('К8: двойной вызов save с теми же данными — rev растёт на 1 один раз', async () => {
    // Ловит: двойной клик по «Купить»/«Готово» пишет дважды (rev +2, лишний сдвиг кольца копий).
    const { mem, session, pid } = await withClub();
    const r0 = rev(mem, pid);
    const next = { ...(session.player.value as { env: { sections: Record<string, { data: object }> } }).env.sections.club!.data, city: 'Тверь' };
    expect(session.save({ club: next })).toEqual({ ok: true });
    expect(session.save({ club: next })).toEqual({ ok: true });
    expect(rev(mem, pid)).toBe(r0 + 1);
    expect(session.save({})).toEqual({ ok: true });
    expect(rev(mem, pid)).toBe(r0 + 1);
  });

  it('К8: реактивный объект и Proxy внутри сырого попадают в запись без Proxy (toRaw, без DataCloneError)', async () => {
    // Ловит: в конверт и в хранилище уходит Proxy Vue (062 А2): structuredClone/IndexedDB бросают DataCloneError.
    const { session, mem, pid } = await withClub();
    const data = (session.player.value as { env: { sections: Record<string, { data: object }> } }).env.sections.club!.data as { kit: object };
    const inner = reactive({ ...data.kit });
    const patch = reactive({ ...data, kit: inner, name: 'Гром' });
    expect(isReactive(patch)).toBe(true);
    expect(session.save({ club: patch })).toEqual({ ok: true });
    const stored = (session.player.value as { env: { sections: Record<string, { data: { kit: object } }> } }).env;
    expect(isReactive(stored.sections.club!.data)).toBe(false);
    expect(isReactive(stored.sections.club!.data.kit)).toBe(false);
    expect(() => structuredClone(stored)).not.toThrow();
    expect(disk(mem, `player.${pid}`).sections.club!.data.name).toBe('Гром');
    expect(isReactive(plain({ a: [reactive({ b: 1 })] }))).toBe(false);
  });

  it('К8: вторая вкладка того же игрока — busy: просмотр есть, запись отказана и диск цел; другой игрок — свободен', async () => {
    // Ловит: две вкладки пишут одного игрока, последняя затирает первую (З1, 063-Р16).
    const { mem, tab, session, pid } = await withClub();
    const second = tab();
    await second.session.init();
    expect(second.session.device.value.kind).toBe('ok');
    await second.session.choose(pid);
    expect(second.session.status.value).toBe('busy');
    expect(second.session.player.value.kind).toBe('ok');
    expect(second.session.entryState().player).toBe('busy');
    const r0 = rev(mem, pid);
    expect(second.session.save({ club: { name: 'Чужой' } })).toEqual({ ok: false, status: 'busy' });
    expect(rev(mem, pid)).toBe(r0);
    expect(session.status.value).toBe('ok');
    const other = await second.session.create({ name: 'Маша' });
    expect(other).toEqual({ ok: true, pid: 'p2' });
    expect(second.session.status.value).toBe('ok');
  });

  it('К8: choose того же игрока — холостой вызов (замок не берётся повторно); сменить игрока отпускает прежнего', async () => {
    // Ловит: повторный choose берёт замок заново (в браузере вкладка «занята» самой собой); замок прежнего игрока не отпущен при смене.
    const { tab, session, store, pid } = await withClub();
    const hold = vi.spyOn(store, 'hold');
    await session.choose(pid);
    await Promise.all([session.choose(pid), session.choose(pid)]);
    expect(hold).not.toHaveBeenCalled();
    expect(session.status.value).toBe('ok');
    const made = await session.create({ name: 'Маша' });
    expect(made.ok).toBe(true);
    await session.choose(pid);
    expect(hold).toHaveBeenCalledTimes(2);
    expect(session.status.value).toBe('ok');
    const second = tab();
    await second.session.init();
    await second.session.choose('p2');
    expect(second.session.status.value).toBe('ok');
  });

  it('К8: квота — игра из памяти, status quota, после освобождения места запись проходит и status ok', async () => {
    // Ловит: при полном хранилище результат пропадает с экрана или статус залипает после успешной записи.
    const { mem, session, pid } = await withClub();
    const club = { ...(session.player.value as { env: { sections: Record<string, { data: object }> } }).env.sections.club!.data };
    mem.capacity = 1;
    const r0 = rev(mem, pid);
    expect(session.save({ club: { ...club, city: 'Омск' } })).toEqual({ ok: false, status: 'quota' });
    expect(session.status.value).toBe('quota');
    expect((session.player.value as { env: { sections: Record<string, { data: { city: string } }> } }).env.sections.club!.data.city).toBe('Омск');
    expect(rev(mem, pid)).toBe(r0);
    mem.capacity = Infinity;
    expect(session.save({ club: { ...club, city: 'Омск', name: 'Новый' } })).toEqual({ ok: true });
    expect(session.status.value).toBe('ok');
    expect(rev(mem, pid)).toBe(r0 + 2);
  });

  it('К8: игрока в списке 4 — пятого создать нельзя; негодные данные — invalid без смены статуса', async () => {
    // Ловит: пятый игрок (больше предела 063-Р11) или запись данных, не прошедших check (битый игрок на диске).
    const { session } = await withClub();
    for (let i = 1; i < MAX_PLAYERS; i++) expect((await session.create({ name: `И${i}` })).ok).toBe(true);
    expect(await session.create({ name: 'Лишний' })).toEqual({ ok: false, why: 'limit' });
    const bad = session.save({ club: { name: 'x'.repeat(99) } });
    expect(bad).toMatchObject({ ok: false, status: 'ok' });
    expect(bad).toHaveProperty('why', expect.arrayContaining(['section:club:name']));
    expect(session.status.value).toBe('ok');
  });

  it('К8: перезагрузка — вкладка помнит игрока (tabPid) и единственного берёт сама; несколько без tabPid — не берёт', async () => {
    // Ловит: после F5 ребёнок снова на «Кто играет?» при единственном игроке или чужой клуб без вопроса при нескольких.
    const { mem, tab } = await withClub();
    const fresh = tab();
    await fresh.session.init();
    expect(fresh.session.tabPid.value).toBe('p1');
    expect(fresh.session.player.value).toMatchObject({ kind: 'ok', pid: 'p1' });
    await fresh.session.create({ name: 'Маша' });
    const again = tab();
    await again.session.init();
    expect(again.session.player.value.kind).toBe('none');
    expect(again.session.entryState()).toMatchObject({ device: 'ok', players: ['p1', 'p2'], tabPid: undefined, player: 'none' });
    expect(mem.map.size).toBeGreaterThan(0);
  });

  it('К8: `current` вне порядка (закрытый пакет) — игрок открывается свободной вкладкой, сохранение другого раздела `current` не трогает', async () => {
    // Ловит: загрузка или запись «чинит» урок закрытого пакета и затирает его (data loss); прежний тест шёл под busy и ничего не проверял.
    const { mem, tab, session, pid } = await withClub();
    await session.create({ name: 'Маша' }); // вкладка перешла на p2: замок p1 свободен
    const env = disk(mem, `player.${pid}`);
    env.sections['course:ru']!.data.current = 'ru.district.zz';
    mem.map.set(`${P}player.${pid}`, JSON.stringify(env));
    const fresh = tab();
    await fresh.session.init();
    await fresh.session.choose(pid);
    expect(fresh.session.status.value).toBe('ok');
    expect(fresh.session.save({ club: { ...env.sections.club!.data, name: 'Гром' } })).toEqual({ ok: true });
    expect(disk(mem, `player.${pid}`).sections.club!.data.name).toBe('Гром');
    expect(disk(mem, `player.${pid}`).sections['course:ru']!.data.current).toBe('ru.district.zz');
  });

  it('К8: игрок новее программы — readonly, запись отказана; битый — broken; адрес /next/ — канал next', async () => {
    // Ловит: запись поверх сохранения новой версии (З1); битый игрок открывается как пустой.
    const { mem, tab, pid } = await withClub();
    const env = disk(mem, `player.${pid}`);
    mem.map.set(`${P}player.${pid}`, JSON.stringify({ ...env, fmt: 99 }));
    const s1 = tab();
    await s1.session.init();
    expect(s1.session.status.value).toBe('readonly');
    expect(s1.session.save({ club: {} })).toEqual({ ok: false, status: 'readonly' });
    mem.map.set(`${P}player.${pid}`, '{не json');
    const s2 = tab();
    await s2.session.init();
    expect(s2.session.status.value).toBe('broken');
    expect(s2.session.entryState().player).toBe('broken');
    expect(channelOf('/keykick/next/')).toBe('next');
    expect(channelOf('/keykick/')).toBe('release');
  });

  it('К10: первый запуск — create, затем save({club}) из черновика на живом хранилище: клуб на диске и после перезагрузки', async () => {
    // Ловит: раздел `club` не доходит до диска (ребёнок после F5 снова на «Новый сезон»), палитра или подрезка теряются, имя игрока не из черновика.
    const { mem, tab } = browser();
    const { session } = tab();
    await session.init();
    const draft = { ...defaultDraft(() => 0), name: '  Метеор  ', city: 'Орёл', backName: 'саша', backNumber: 7, palette: 5, coach: 'veteran' };
    const made = await session.create({ name: playerNameOf(draft, 'Игрок') });
    expect(made.ok).toBe(true);
    const club = clubFromDraft(draft);
    expect(session.save({ club })).toEqual({ ok: true });
    expect(disk(mem, 'player.p1').sections['club']!.data).toEqual(club);
    expect(club).toMatchObject({ name: 'Метеор', backName: 'САША', backNumber: 7, kit: PALETTES[5] });
    const fresh = tab();
    await fresh.session.init();
    const env = (fresh.session.player.value as { env: { name: string; sections: Record<string, { data: unknown }> } }).env;
    expect(env.name).toBe('саша');
    expect(env.sections['club']!.data).toEqual(club);
  });
});

describe('session: отказы записи, гонки и устройство новее (К8, Р31)', () => {
  const clubOf = (session: { player: { value: unknown } }) =>
    (session.player.value as { env: { sections: Record<string, { data: object }> } }).env.sections.club!.data;

  it('К8: квота → место освободили → тот же save повторён — диск обновлён и status ok (итог матча не теряется)', async () => {
    // Ловит: после отказа данные уже в памяти, и повтор того же save сравнивается с памятью: «равные» → ok без записи, на диске прежнее (блокер ревью-1).
    const { mem, session, pid } = await withClub();
    const next = { ...clubOf(session), city: 'Омск' };
    const r0 = rev(mem, pid);
    mem.capacity = 1;
    expect(session.save({ club: next })).toEqual({ ok: false, status: 'quota' });
    mem.capacity = Infinity;
    expect(session.save({ club: next })).toEqual({ ok: true });
    expect(session.status.value).toBe('ok');
    expect(disk(mem, `player.${pid}`).sections.club!.data).toMatchObject({ city: 'Омск' });
    expect(rev(mem, pid)).toBeGreaterThan(r0);
    const r1 = rev(mem, pid);
    expect(session.save({ club: next })).toEqual({ ok: true });
    expect(rev(mem, pid)).toBe(r1); // записано — снова «ничего нового»
  });

  it('К8: квота, затем пустой save({}) — тоже пишет отложенное', async () => {
    // Ловит: «ничего нового» при памяти впереди диска: экран зовёт save({}) на «сохранить ещё раз» и ничего не пишется.
    const { mem, session, pid } = await withClub();
    mem.capacity = 1;
    expect(session.save({ club: { ...clubOf(session), city: 'Тула' } }).ok).toBe(false);
    mem.capacity = Infinity;
    expect(session.save({})).toEqual({ ok: true });
    expect(disk(mem, `player.${pid}`).sections.club!.data).toMatchObject({ city: 'Тула' });
  });

  it('К8: отказ доступа (SecurityError, Р31) — status quota, игра из памяти, после снятия отказа запись проходит', async () => {
    // Ловит: отказ доступа выдан за conflict/readonly/ok или бросает исключение: ребёнок видит не ту плашку.
    const { mem, session, pid } = await withClub();
    const next = { ...clubOf(session), city: 'Пермь' };
    mem.failWrite = 'SecurityError';
    expect(session.save({ club: next })).toEqual({ ok: false, status: 'quota' });
    expect(session.status.value).toBe('quota');
    expect(clubOf(session)).toMatchObject({ city: 'Пермь' });
    mem.failWrite = undefined;
    expect(session.save({ club: next })).toEqual({ ok: true });
    expect(disk(mem, `player.${pid}`).sections.club!.data).toMatchObject({ city: 'Пермь' });
  });

  it('К8: на диске другая запись — conflict держится на любом save до reload, затем игра снова пишет', async () => {
    // Ловит: conflict сбрасывается сам при следующем save (затёрли бы чужую запись) или не снимается после «обнови страницу».
    const { mem, session, pid } = await withClub();
    const env = disk(mem, `player.${pid}`);
    mem.map.set(`${P}player.${pid}`, JSON.stringify({ ...env, rev: env.rev + 5 }));
    expect(session.save({ club: { ...clubOf(session), city: 'Ижевск' } })).toEqual({ ok: false, status: 'conflict' });
    expect(session.status.value).toBe('conflict');
    const raw = mem.map.get(`${P}player.${pid}`);
    expect(session.save({ club: { ...clubOf(session), city: 'Ижевск' } })).toEqual({ ok: false, status: 'conflict' });
    expect(session.save({ club: { ...clubOf(session), city: 'Уфа' } })).toEqual({ ok: false, status: 'conflict' });
    expect(mem.map.get(`${P}player.${pid}`)).toBe(raw);
    await session.reload();
    expect(session.status.value).toBe('ok');
    expect(session.save({ club: { ...clubOf(session), city: 'Уфа' } })).toEqual({ ok: true });
    expect(disk(mem, `player.${pid}`).sections.club!.data).toMatchObject({ city: 'Уфа' });
  });

  it('К8: двойной «Готово» — create в полёте возвращает тот же ответ, игрок один', async () => {
    // Ловит: два вызова create подряд (двойной клик) делают два клуба и два pid (ревью-1, session.ts:202).
    const { tab, mem } = browser();
    const { session } = tab();
    await session.init();
    const [x, y] = await Promise.all([session.create({ name: 'Саша' }), session.create({ name: 'Саша' })]);
    expect(x).toEqual({ ok: true, pid: 'p1' });
    expect(y).toEqual(x);
    expect(disk(mem, 'device').players).toEqual([{ pid: 'p1', order: 0 }]);
    expect([...mem.map.keys()].filter((k) => k.startsWith(`${P}player.`))).toEqual([`${P}player.p1`]);
    expect((await session.create({ name: 'Маша' })).ok).toBe(true); // после ответа — снова можно
  });

  it('К8: гонка choose(A)/choose(B) — побеждает последний, замок A отпущен, другая вкладка берёт A свободно', async () => {
    // Ловит: устаревший choose (ждал замок, вкладка выбрала другого) не откатывается: замок A утекает, вторая вкладка видит «занято» навсегда.
    const { tab, session, pid } = await withClub();
    await session.create({ name: 'Маша' }); // p2, вкладка на p2
    const second = tab();
    await second.session.init();
    await Promise.all([second.session.choose(pid), second.session.choose('p2').catch(() => undefined)]);
    expect(second.session.tabPid.value).toBe('p2');
    expect(second.session.player.value).toMatchObject({ pid: 'p2' });
    const third = tab();
    await third.session.init();
    await third.session.choose(pid);
    expect(third.session.status.value).toBe('ok');
  });

  it('К8: два choose(p) разом на свежей вкладке — замок берётся один раз, вкладка не «занята сама собой»', async () => {
    // Ловит: повторный choose при ждущем замке берёт замок второй раз — вкладка busy от самой себя.
    const { tab, session } = await withClub();
    await session.create({ name: 'Маша' }); // вкладка session на p2: p1 свободен
    const fresh = tab();
    await fresh.session.init();
    const hold = vi.spyOn(fresh.store, 'hold');
    await Promise.all([fresh.session.choose('p1'), fresh.session.choose('p1')]);
    expect(hold).toHaveBeenCalledTimes(1);
    expect(fresh.session.status.value).toBe('ok');
  });

  it('К8: устройство новее или битое — create отказан, лишних ключей на диске нет', async () => {
    // Ловит: create при newer/broken устройстве пишет игрока (ключ-сирота, затирает чужое устройство).
    for (const [raw, why] of [
      [JSON.stringify({ kind: 'keykick-device', fmt: 99, rev: 1, players: [] }), 'readonly'],
      ['{не json', 'broken'],
    ] as const) {
      const { mem, tab } = browser();
      mem.map.set(`${P}device`, raw);
      const { session } = tab();
      await session.init();
      const before = mem.snapshot();
      expect(await session.create({ name: 'Саша' })).toEqual({ ok: false, why });
      expect(mem.snapshot()).toEqual(before);
      expect([...mem.map.keys()].some((k) => k.startsWith(`${P}player.`))).toBe(false);
    }
  });
});

describe('session.transfer: один мост к хранилищу (063-Р5, Т11)', () => {
  const MADE = '2026-11-18T10:00:00.000Z';

  it('К11 сеанс не отдаёт Store наружу; запись файла на чистом устройстве перечитывает сеанс сама', async () => {
    // Ловит: экран получает `store` в обход моста, или после «Вернуть клуб» сеанс остаётся пустым (Дом без игрока до перезагрузки).
    const { session: source } = await withClub();
    const out = source.transfer.exportText(MADE, 'https://example.org/keykick/next/');
    if (!out.ok) throw new Error('export');
    const { tab } = browser();
    const { session } = tab();
    await session.init();
    expect('store' in session).toBe(false);
    expect(session.device.value.kind).toBe('absent');
    expect((await session.transfer.apply(session.transfer.plan(out.text), {})).ok).toBe(true);
    expect(session.entryState()).toMatchObject({ device: 'ok', players: ['p1'], player: 'ok' });
    expect(session.status.value).toBe('ok');
  });

  it('К11 отметка выгрузки обновляет устройство в сеансе: следующий create пишет по свежему rev, а не conflict', async () => {
    // Ловит: markExported двигает rev устройства на диске, а сеанс держит старый — «новый игрок» после выгрузки падает в conflict.
    const { session } = await withClub();
    expect(session.transfer.markExported('2026-11-18')).toBe(true);
    expect(await session.create({ name: 'Маша' })).toEqual({ ok: true, pid: 'p2' });
  });

  it('К11 отказ записи после первой записи своего игрока: сеанс всё равно перечитывается и видит диск', async () => {
    // Ловит: apply записал игрока вкладки, упал на списке устройства, а сеанс показывает прежнего игрока (следующий save затрёт записанное).
    const source = await withClub('Источник');
    await source.session.create({ name: 'Маша' });
    const out = source.session.transfer.exportText(MADE, 'https://example.org/keykick/next/');
    if (!out.ok) throw new Error('export');
    const local = await withClub('Местный');
    const set = local.mem.setItem.bind(local.mem);
    local.mem.setItem = (k, v) => {
      if (k === `${P}device`) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
      set(k, v);
    };
    const res = await local.session.transfer.apply(local.session.transfer.plan(out.text), { p1: 'file' });
    expect(res).toMatchObject({ ok: false, why: 'quota', written: ['p1', 'p2'] });
    const cur = local.session.player.value;
    expect(cur.kind === 'ok' && (cur.env.sections.club!.data as { name: string }).name).toBe('Источник');
  });

  it('К11 чужие записи не стирают память своего игрока: квота у своего, apply дописал другого — сыгранное цело', async () => {
    // Ловит: после apply сеанс перечитывает своего игрока с диска, хотя apply его не писал, — результат, что был только в памяти (квота), пропадает.
    const source = await withClub('Другой');
    const out = source.session.transfer.exportText(MADE, 'https://example.org/keykick/next/');
    if (!out.ok) throw new Error('export');
    const local = await withClub('Местный');
    const set = local.mem.setItem.bind(local.mem);
    let full = true;
    local.mem.setItem = (k, v) => {
      if (full && k.startsWith(`${P}player.`)) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
      set(k, v);
    };
    const club = (local.session.player.value as { env: { sections: Record<string, { data: object }> } }).env.sections.club!.data;
    expect(local.session.save({ club: { ...club, city: 'Тверь' } })).toMatchObject({ ok: false });
    expect(local.session.status.value).toBe('quota');
    // Файл другого игрока (p1 источника) получает свой pid: переименуем так, чтобы он не совпал со своим.
    const text = out.text.replaceAll('"p1"', '"p9"');
    full = false;
    const res = await local.session.transfer.apply(local.session.transfer.plan(text), {});
    expect(res).toMatchObject({ ok: true, added: 1, written: ['p9'] });
    expect(local.session.device.value.kind === 'ok' && local.session.device.value.value.players.map((p) => p.pid)).toEqual(['p1', 'p9']);
    const cur = local.session.player.value;
    expect(cur.kind === 'ok' && (cur.env.sections.club!.data as { city: string }).city).toBe('Тверь');
    expect(local.session.status.value).toBe('quota');
  });
});

describe('session: вкладка родителя только смотрит (063-Р59)', () => {
  const MADE = '2026-11-18T10:00:00.000Z';
  it('К11 init({ look }): игрока не берёт и замок не держит — вкладка ребёнка пишет свободно, выгрузка идёт с диска', async () => {
    // Ловит: страница родителя берёт замок единственного игрока — вкладка ребёнка становится «занятой», её запись отказана (потеря сыгранного).
    const kid = await withClub('Метеор');
    const parent = kid.tab();
    await parent.session.init({ look: true });
    expect(parent.session.player.value.kind).toBe('none');
    expect(parent.session.tabPid.value).toBeUndefined();
    expect(parent.session.entryState()).toMatchObject({ device: 'ok', players: ['p1'], player: 'none' });
    expect(kid.session.status.value).toBe('ok');
    const club = (kid.session.player.value as { env: { sections: Record<string, { data: object }> } }).env.sections.club!.data;
    expect(kid.session.save({ club: { ...club, city: 'Тверь' } })).toEqual({ ok: true });
    const out = parent.session.transfer.exportText(MADE, 'https://example.org/keykick/next/');
    expect(out.ok && out.text.includes('Тверь')).toBe(true);
  });

  it('К11 вкладка-просмотр помнит выбор вкладки из sessionStorage: tabPid есть, игрока и замка нет; чужой pid не берётся', async () => {
    // Ловит: tabPid в просмотре пропадает — уходя со страницы родителя в игру, вкладка с выбранным игроком попадает в «Кто играет?».
    const kid = await withClub('Метеор');
    const parent = kid.tab();
    parent.store.setTabPid('p1');
    await parent.session.init({ look: true });
    expect(parent.session.tabPid.value).toBe('p1');
    expect(parent.session.player.value.kind).toBe('none');
    expect(parent.session.status.value).toBe('ok');
    expect(kid.session.status.value).toBe('ok');
    expect(enter({ ...parent.session.entryState(), pack: 'ok', route: '#/home', crash: false })).toEqual({ kind: 'choose', pid: 'p1' });
    const stale = kid.tab();
    stale.store.setTabPid('p9');
    await stale.session.init({ look: true });
    expect(stale.session.tabPid.value).toBeUndefined();
  });

  it('К11 запись файла из вкладки-просмотра: сеанс перечитывается, но игрока и замок не берёт (режим держится до явного choose)', async () => {
    // Ловит: `apply` → `reload` → `run` снова берёт единственного игрока: вкладка родителя «занимает» игрока, пока ребёнок играет.
    const kid = await withClub('Метеор');
    const file = await withClub('Из файла');
    const out = file.session.transfer.exportText(MADE, 'https://example.org/keykick/next/');
    if (!out.ok) throw new Error('export');
    const parent = kid.tab();
    await parent.session.init({ look: true });
    const res = await parent.session.transfer.apply(parent.session.transfer.plan(out.text), { p1: 'mine' });
    expect(res).toEqual({ ok: true, added: 0, replaced: 0, kept: 1, written: [], binLeft: [] });
    expect(parent.session.player.value.kind).toBe('none');
    expect(kid.session.status.value).toBe('ok');
    const club = (kid.session.player.value as { env: { sections: Record<string, { data: object }> } }).env.sections.club!.data;
    expect(kid.session.save({ club: { ...club, city: 'Орёл' } })).toEqual({ ok: true });
    // Явный выбор (охрана входа: вкладка уходит играть) выходит из режима просмотра и берёт замок: игрок занят ребёнком — просмотр.
    await parent.session.choose('p1');
    expect(parent.session.status.value).toBe('busy');
    // Ловит: choose не снял режим просмотра — после перечитывания в той же вкладке игрок пропадает, Дом без игрока (З2).
    await parent.session.reload();
    expect(parent.session.player.value.kind).toBe('ok');
    expect(parent.session.status.value).toBe('busy');
  });
});

describe('saveClubFile: память или диск (063-Р58)', () => {
  const clubOf = (session: { player: { value: unknown } }) =>
    (session.player.value as { env: { sections: Record<string, { data: object }> } }).env.sections.club!.data;
  const NOW = new Date('2026-11-18T10:00:00Z');

  it('К12 (063-Р58): saveClubFile при квоте кладёт память, при busy — диск', async () => {
    // Ловит: при квоте файл берёт устаревший диск (сыгранное теряется — файл единственный путь) или при busy берёт устаревшую копию вкладки (в файл уходит старое).
    downloaded.length = 0;
    const q = await withClub();
    q.mem.capacity = 1;
    expect(q.session.save({ club: { ...clubOf(q.session), city: 'Омск' } })).toMatchObject({ ok: false, status: 'quota' });
    expect(saveClubFile(q.session, NOW, 'https://example.org/keykick/next/')).toMatchObject({ ok: true });
    expect(downloaded.at(-1)).toContain('Омск');
    expect(disk(q.mem, `player.${q.pid}`).sections.club!.data).not.toMatchObject({ city: 'Омск' });

    // Вторая вкладка — busy со своей копией; первая пишет после — в файле свежее с диска.
    const first = await withClub();
    const second = first.tab();
    await second.session.init();
    await second.session.choose(first.pid);
    expect(second.session.status.value).toBe('busy');
    expect(first.session.save({ club: { ...clubOf(first.session), city: 'Тверь' } })).toEqual({ ok: true });
    expect(clubOf(second.session)).not.toMatchObject({ city: 'Тверь' });
    expect(saveClubFile(second.session, NOW, 'https://example.org/keykick/next/')).toMatchObject({ ok: true });
    expect(downloaded.at(-1)).toContain('Тверь');
  });
});
