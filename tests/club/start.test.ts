/**
 * Первый запуск (063 Т6а, К10): шаги, черновик клуба, расцветки и перекраска формы. У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import clubs from '../../src/content/clubs.json';
import { RIVAL_TRIM, rivalBodyOf, rivalKitOf } from '../../src/engine/club/rival';
import { blends, rivalOf } from '../../src/engine/cup/teams';
import { hexToRgb, inStar, kantTrim, KANT_GOLD, milestoneTone, paintKit, patternAt, starSpots, yellowWithBlue, type KitLayers } from '../../src/engine/club/paint';
import { NEUTRAL_DARK, NEUTRAL_LIGHT, opaqueBox, outfitFor, paintZones } from '../../src/engine/club/outfit';
import { milestoneDeco } from '../../src/engine/album/locker';
import { KIT_IDS } from '../../src/engine/album/order';
import { kitOf } from '../../src/engine/album/kit';
import { stored } from '../../src/app/club/edit';
import { crowdHue, recolorCrowd } from '../../src/engine/club/crowd';
import { clubDef, type ClubKit } from '../../src/engine/club/section';
import { PALETTES, clubFromDraft, cityHints, defaultDraft, draftProblems, dmy, loadCheck, nextStep, numberDigits, numberOf, playerNameOf, coachEnter, draftOfClub, shortVersion, badReason, coachNameOf, restoreFile } from '../../src/engine/club/start';
import { factLine, fileLine } from '../../src/components/club/restoreLines';
import type { Device } from '../../src/engine/save/device';
import { createPlayer, writePlayer } from '../../src/engine/save/envelope';
import { planImport } from '../../src/engine/save/import';
import { makeSnapshot, serializeSnapshot } from '../../src/engine/save/snapshot';
import { SECTIONS } from '../../src/app/save/sections';
import { providedHardKeys } from '../../src/app/club/provide';
import { backLine, bestSpeed, clubCard, hardKeysOf, swapCoach } from '../../src/engine/club/card';

const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length]!;
};

describe('первый запуск (К10)', () => {
  it('К10: шаги идут новый → клуб → тренер → приветствие; Esc возвращает на шаг назад; чужое событие и повтор ничего не ломают', () => {
    // Ловит: двойной клик «Начать» уносит дальше шага; Esc в окне клуба теряет карточку «новый сезон»; «загрузить» открывается с чужого шага.
    expect(nextStep('new', 'club')).toBe('club');
    expect(nextStep('club', 'club')).toBe('club');
    expect(nextStep('club', 'coach')).toBe('coach');
    expect(nextStep('coach', 'pick')).toBe('greet');
    expect(nextStep('greet', 'pick')).toBe('greet');
    expect(nextStep('greet', 'back')).toBe('coach');
    expect(nextStep('club', 'back')).toBe('new');
    expect(nextStep('new', 'load')).toBe('load');
    expect(nextStep('coach', 'load')).toBe('coach');
    expect(nextStep('load', 'back')).toBe('new');
  });

  it('К10: расцветок девять, и ни в одной нет жёлтого рядом с синим (ТАБУ)', () => {
    // Ловит: выбор формы даёт сине-жёлтую форму (правило В1) или палитра clubs.json потеряла расцветки.
    expect(clubs.palettes).toHaveLength(9);
    expect(PALETTES).toHaveLength(9);
    for (const p of PALETTES) expect(yellowWithBlue(p), JSON.stringify(p)).toBe(false);
    const bad: ClubKit = { pattern: 'stripes', body: '#2f6fe0', alt: '#f5c400', sleeves: '#2f6fe0', trim: '#ffffff' };
    expect(yellowWithBlue(bad)).toBe(true);
  });

  it('К10: клуб из черновика проходит проверку раздела при любой расцветке; тексты подрезаны, имя на спине — заглавными', () => {
    // Ловит: первый запуск пишет клуб, который не проходит `check` (запись игрока отказала бы с `invalid`); длинное имя ломает границы Р30.
    for (let i = 0; i < PALETTES.length; i++) {
      const d = { ...defaultDraft(seq(0.3)), palette: i };
      expect(clubDef.check(clubFromDraft(d)), `палитра ${i}`).toEqual([]);
    }
    const long = { ...defaultDraft(seq(0.1)), name: `  ${'Ы'.repeat(40)}  `, city: 'Т'.repeat(60), backName: 'саша-кузнечик-длинный', coach: 'нет-такого' };
    const club = clubFromDraft(long);
    expect(club.name).toHaveLength(20);
    expect(club.city).toHaveLength(24);
    expect(club.backName).toBe('САША-КУЗНЕЧИ'); // 12 знаков
    expect(club.coach).toBe('young');
    expect(clubDef.check(club)).toEqual([]);
  });

  it('К10: без названия клуб не создаётся; номер вне 0–99 — тоже; имя игрока — имя на спине, иначе запасное', () => {
    // Ловит: пустой клуб (`name === ''`) уходит в Дом как «первый запуск не пройден»; номер 150 ломает раздел.
    const d = defaultDraft(seq(0.2));
    expect(draftProblems(d)).toEqual([]);
    expect(draftProblems({ ...d, name: '   ' })).toEqual(['name']);
    expect(draftProblems({ ...d, backNumber: 150 })).toEqual(['number']);
    expect(playerNameOf({ ...d, backName: ' Саша ' }, 'Игрок')).toBe('Саша');
    expect(playerNameOf({ ...d, backName: '' }, 'Игрок')).toBe('Игрок');
  });

  it('К10: подсказки города — по началу набора, «орел» находит «Орёл», пустой набор — без подсказок', () => {
    // Ловит: ребёнок без «ё» не находит город (ТЗ 019-Т15); пустое поле сыплет все 30 городов.
    expect(cityHints('орел')).toEqual(['Орёл']);
    expect(cityHints('  ')).toEqual([]);
    expect(cityHints('к', 3)).toHaveLength(3);
  });

  it('К10: файл клуба — мусор, чужой или новее — окно «Файл не подошёл»; игроков в файле нет — тоже', () => {
    // Ловит: битый файл показан как «проверен» и обещает вернуть клуб, которого нет.
    const here = { device: { players: [] }, players: [] };
    for (const text of ['', 'не json', '{"x":1}', '{"kind":"keykick-club","snap":99}']) {
      expect(loadCheck(planImport(text, here, SECTIONS, {})), text).toEqual({ phase: 'bad' });
    }
    // снимок без игроков: файл разбирается, но возвращать нечего — «не подошёл», а не пустое «Что изменится»
    const device: Device = { kind: 'keykick-device', fmt: 1, rev: 1, players: [], uiLang: 'ru', sound: { music: 0.5 }, parent: { gate: 'none' } };
    const meta = { app: '2.0.0', made: '2026-11-18T10:00:00.000Z', from: 'https://example.org/keykick/next/' };
    const empty = serializeSnapshot(makeSnapshot(device, [], meta));
    expect(loadCheck(planImport(empty, here, SECTIONS, {}))).toEqual({ phase: 'bad' });
    // годный файл с одним игроком — «Что изменится» с его именем
    const one = serializeSnapshot(makeSnapshot({ ...device, players: [{ pid: 'a', order: 0 }] }, [createPlayer({ pid: 'a', name: 'Саша' }, SECTIONS)], meta));
    expect(loadCheck(planImport(one, here, SECTIONS, {}))).toMatchObject({ phase: 'check', players: [{ name: 'Саша' }] });
  });

  it('К10: причина отказа файла — новее игры или не открывается (063-Р49 п. 3)', () => {
    // Ловит: на «Файл не подошёл» одна и та же отговорка для повреждённого и для более нового файла — ребёнок «обновляет» мусор.
    const here = { device: { players: [] }, players: [] };
    expect(badReason(planImport('{"kind":"keykick-club","snap":99}', here, SECTIONS, {}))).toBe('newer');
    for (const text of ['', 'не json', '{"x":1}']) expect(badReason(planImport(text, here, SECTIONS, {})), text).toBe('bad');
  });

  it('К10: подпись реплики тренера на Доме — имя выбранного тренера клуба, не всегда Макс (очередь п. 14)', () => {
    // Ловит: «Тренер Макс» у всех, кто выбрал Веру, Бас или Степаныча (CoachBubble брал имя по умолчанию).
    expect(coachNameOf('ponytail')).toBe('Тренер Вера');
    expect(coachNameOf('bigbeard')).toBe('Тренер Бас');
    expect(coachNameOf('veteran')).toBe('Тренер Степаныч');
    // тренера нет или id устарел — по умолчанию (Макс), а не пустая подпись
    expect(coachNameOf(undefined)).toBe('Тренер Макс');
    expect(coachNameOf('')).toBe('Тренер Макс');
    expect(coachNameOf('нет-такого')).toBe('Тренер Макс');
  });

  it('К10: «Что изменится» (Т6а, М3) — строка файла (дата, версия) и «Урок N · Монеты N · Играл ДД.ММ.ГГГГ» из данных снимка; чего нет — не показываем', () => {
    // Ловит: в окне только «Монеты · Звёзды» (монеты читались из устаревшего club.coins и всегда были 0); нет строки «Файл от…», урока и дня игры; прочерк вместо пропуска.
    const here = { device: { players: [] }, players: [] };
    const device: Device = { kind: 'keykick-device', fmt: 1, rev: 1, players: [{ pid: 'a', order: 0 }, { pid: 'b', order: 1 }], uiLang: 'ru', sound: { music: 0.5 }, parent: { gate: 'none' } };
    const meta = { app: '2.0.0', made: '2026-11-08T23:30:00.000Z', from: 'https://example.org/keykick/next/' };
    const played = writePlayer(createPlayer({ pid: 'a', name: 'Саша' }, SECTIONS), {
      'course:ru': { current: 'ru.yard.fzh', lessons: {}, archive: {}, leaguesDone: {} },
      wallet: { coins: 204, rest: 0, paid: [] },
      day: { played: 3, days: 2, today: '2026-11-08', todayN: 1, last: 1 },
    });
    const fresh = createPlayer({ pid: 'b', name: 'Миша' }, SECTIONS); // новый игрок: монет 0, игровых дней не было
    const order = ['ru.yard.ao', 'ru.yard.ao-pairs', 'ru.yard.vl', 'ru.yard.vl-combos', 'ru.yard.first-words', 'ru.yard.yd', 'ru.yard.yd-combos', 'ru.yard.six-keys-words', 'ru.yard.six-keys-review', 'ru.yard.fzh'];
    const text = serializeSnapshot(makeSnapshot(device, [played, fresh], meta));
    const res = loadCheck(planImport(text, here, SECTIONS, {}), order);
    if (res.phase !== 'check') throw new Error('файл должен подойти');
    expect(res.file).toEqual({ date: '08.11.2026', version: '2.0' }); // день как записан в файле, без пересчёта пояса (23:30 UTC остаётся 08.11)
    expect(res.players[0]).toEqual({ name: 'Саша', facts: [{ kind: 'lesson', n: 10 }, { kind: 'coins', n: 204 }, { kind: 'played', date: '08.11.2026' }] });
    expect(res.players[1]!.facts).toEqual([{ kind: 'lesson', n: 1 }, { kind: 'coins', n: 0 }]); // «Играл» нет — игровых дней не было
    // порядка уроков нет (пакет не загрузился) — «Урок» пропускается, остальное на месте
    const offline = loadCheck(planImport(text, here, SECTIONS, {}));
    expect(offline.phase === 'check' && offline.players[0]!.facts.map((f) => f.kind)).toEqual(['coins', 'played']);
    // края форматов
    expect(dmy('2026-11-08')).toBe('08.11.2026');
    expect(dmy('вчера')).toBeNull();
    expect(shortVersion('2.0.0')).toBe('2.0');
    expect(shortVersion('')).toBeNull();
  });

  it('К10: строка «Файл от …» (063-Р46) — одна сборка на «Клуб пропал?» и страницу родителя: части, которых в файле нет, пропускаются', () => {
    // Ловит: у родителя «Файл от 18.11.2026 · » с пустым хвостом или «версия игры» без версии; у ребёнка и родителя строка собрана по-разному.
    expect(fileLine(restoreFile({ made: '2026-11-18T10:00:00.000Z', app: '2.0.0' }))).toBe('Файл от 18.11.2026 · версия игры 2.0');
    expect(fileLine(restoreFile({ made: 'вчера', app: '2.0.0' }))).toBe('версия игры 2.0');
    expect(fileLine(restoreFile({ made: '2026-11-18', app: '' }))).toBe('Файл от 18.11.2026');
    expect(fileLine(restoreFile({ made: 'вчера', app: '' }))).toBe('');
    expect(factLine([{ kind: 'lesson', n: 14 }, { kind: 'coins', n: 204 }, { kind: 'played', date: '08.11.2026' }])).toBe('Урок 14 · Монеты 204 · Играл 08.11.2026');
    expect(factLine([])).toBe('');
  });

  it('К10: перекраска — корпус берёт цвет формы, окантовка свой; «split» красит рукав в цвет своей половины', () => {
    // Ловит: зоны слоёв перепутаны (корпус в цвет окантовки); у «половинок» рукава одного цвета на обеих сторонах.
    // слой 4×1: корпус, корпус, окантовка, рукав; затемнение 255 (без тени), блика нет, всё непрозрачное
    const zones = new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 255, 0, 255]);
    const shade = new Uint8ClampedArray([255, 0, 255, 255, 255, 0, 255, 255, 255, 0, 255, 255, 255, 0, 255, 255]);
    const layers: KitLayers = { width: 4, height: 1, zones, shade };
    const rgb = (px: Uint8ClampedArray, n: number) => [...px.slice(n * 4, n * 4 + 3)].map((c) => c / 255);
    const kit: ClubKit = { pattern: 'plain', body: '#2f9a27', sleeves: '#ffffff', trim: '#16161a' };
    const out = paintKit(layers, kit);
    expect(rgb(out, 0)).toEqual(hexToRgb('#2f9a27').map((c) => Math.round(c * 255) / 255));
    expect(rgb(out, 2)).toEqual(hexToRgb('#16161a').map((c) => Math.round(c * 255) / 255));
    expect(rgb(out, 3)).toEqual([1, 1, 1]);
    const halves = paintKit(layers, { pattern: 'halves', body: '#2f9a27', alt: '#ffffff', sleeves: 'split', trim: '#16161a' });
    expect(rgb(halves, 3)).toEqual([1, 1, 1]); // правая половина — второй цвет
    expect(patternAt('halves', 0.7, 0.5)).toBe(true);
    expect(patternAt('plain', 0.7, 0.5)).toBe(false);
  });

  it('К10: номер на спине — только цифры, не длиннее «99»; «a7» → «7», без цифр → 0', () => {
    // Ловит: поле «Номер» принимало буквы («a7» оставалось, на форме пусто, в сохранении backNumber 0).
    expect(numberDigits('a7')).toBe('7');
    expect(numberOf('a7')).toBe(7);
    expect(numberDigits('1b2c3')).toBe('12');
    expect(numberDigits('٣7')).toBe('7'); // не-ASCII цифры тоже не пускаем
    expect(numberOf('abc')).toBe(0);
    expect(numberOf('')).toBe(0);
    expect(numberOf('07')).toBe(7);
    expect(numberOf('999')).toBe(99);
  });

  it('К10: Enter на выборе тренера — на карточке и вне кнопок подтверждает, на кнопке жмёт её сама', () => {
    // Ловит: Enter на карточке «Тренер Вера» только выбирал её, подтверждала лишь кнопка «Выбрать».
    expect(coachEnter('card')).toBe('confirm');
    expect(coachEnter('none')).toBe('confirm');
    expect(coachEnter('button')).toBe('native');
  });
});

describe('люди на трибуне в цветах клуба (065 Т7в, Р80)', () => {
  const green: ClubKit = { pattern: 'plain', body: '#2f9a27', sleeves: '#ffffff', trim: '#ffffff' };
  it('К13 цвета клуба: цвет формы → оттенок людей; синий и «без цвета» — не перекрашиваем', () => {
    // Ловит: зелёно-белый клуб (образец кадров, 023-Р30) и красный клуб получают синих болельщиков; синий клуб зря гоняет перекраску.
    expect(crowdHue(green)).toBeGreaterThan(90);
    expect(crowdHue(green)).toBeLessThan(140);
    expect(crowdHue({ pattern: 'plain', body: '#2f6fe0', sleeves: '#ffffff', trim: '#ffffff' })).toBeNull();
    expect(crowdHue({ pattern: 'plain', body: '#ffffff', sleeves: '#f4f4f4', trim: '#16161a' })).toBeNull();
    // тело чёрное — берём второй цвет (клуб «чёрное с жёлтым»)
    expect(crowdHue({ pattern: 'hoops', body: '#16161a', alt: '#f5c400', sleeves: '#16161a', trim: '#f5c400' })).toBeGreaterThan(40);
    expect(crowdHue(undefined)).toBeNull();
    expect(crowdHue({ pattern: 'halves', body: 'нет', sleeves: 'split', trim: 'x' })).toBeNull();
  });
  it('К13 перекраска: синий становится зелёным, белое, кожа и прозрачность остаются', () => {
    // Ловит: перекраска задевает кожу и белую майку (лица зелёные) или не меняет синее (кадр остаётся сине-белым).
    const px = new Uint8ClampedArray([47, 111, 224, 255, 255, 255, 255, 255, 226, 160, 120, 255, 31, 79, 163, 0]);
    recolorCrowd(px, crowdHue(green)!);
    const [r, g, b] = [px[0]!, px[1]!, px[2]!];
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
    expect([...px.slice(4, 12)]).toEqual([255, 255, 255, 255, 226, 160, 120, 255]);
    expect(px[15]).toBe(0);
  });

  it('К9д: шорты и гетры — цвета из формы клуба: соперник «оранжевый с чёрным» даёт чёрные шорты и оранжевую полосу, зелёно-белая — белые', () => {
    // Ловит: шорты цвета корпуса (сливаются с футболкой); у соперника перепутаны зоны «корпус, полоса, пояс»; нейтральный цвет не выбран.
    const rival: ClubKit = { pattern: 'plain', body: '#f28a1c', sleeves: 'split', trim: '#1f1f1f' };
    const o = outfitFor(rival);
    expect(o.shorts).toEqual({ body: '#1f1f1f', stripe: '#f28a1c', waist: '#f28a1c' }); // как в кадре Э1.01 (МК-1)
    expect(o.socks).toEqual({ leg: '#f28a1c', top: '#1f1f1f', foot: '#1f1f1f' });
    const mine = outfitFor({ pattern: 'plain', body: '#2f9a27', sleeves: '#ffffff', trim: '#ffffff' });
    expect(mine.shorts.body).toBe('#ffffff');
    expect(mine.shorts.stripe).toBe('#2f9a27');
    // форма из одного цвета: нет второго — берётся нейтральный (тёмный к светлому, белый к тёмному)
    expect(outfitFor({ pattern: 'plain', body: '#ffffff', sleeves: '#ffffff', trim: '#ffffff' }).shorts.body).toBe(NEUTRAL_DARK);
    expect(outfitFor({ pattern: 'plain', body: '#101010', sleeves: '#101010', trim: '#101010' }).shorts.body).toBe(NEUTRAL_LIGHT);
  });

  it('К9д: перекраска шорт по трём зонам и рамка предмета на слое с полями', () => {
    // Ловит: зоны шорт перепутаны (полоса вместо корпуса); рамка считается по зонам, а не по непрозрачности (поля слоя уехали бы в раскладку).
    // слой 4×2: в верхнем ряду пусто, в нижнем — корпус, полоса, пояс; зоны — в долях R, G, B
    const zones = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0]);
    const clear = [255, 0, 0, 0];
    const solid = [255, 0, 255, 255];
    const shade = new Uint8ClampedArray([...clear, ...clear, ...clear, ...clear, ...solid, ...solid, ...solid, ...clear]);
    const layers: KitLayers = { width: 4, height: 2, zones, shade };
    const out = paintZones(layers, ['#ff0000', '#00ff00', '#0000ff']);
    expect([...out.slice(16, 20)]).toEqual([255, 0, 0, 255]);
    expect([...out.slice(20, 24)]).toEqual([0, 255, 0, 255]);
    expect([...out.slice(24, 28)]).toEqual([0, 0, 255, 255]);
    expect(out[3]).toBe(0); // пусто — прозрачно
    expect(opaqueBox(layers)).toEqual({ x: 0, y: 0.5, w: 0.75, h: 0.5 });
    expect(opaqueBox({ ...layers, shade: new Uint8ClampedArray(32) })).toBeNull();
  });
});

describe('карточка клуба (067 Т11 §6, ТЗ-1.13)', () => {
  const mark = (best: number) => ({ stars: 1 as const, best, tries: 1, fails: 0 });
  const course = { lessons: { a: mark(12), b: mark(24) }, archive: { c: mark(30) } };

  it('067 Т11 §6: карточка берёт числа из разделов, лучшую скорость — максимум по урокам и архиву; пустой клуб — нули', () => {
    // Ловит: скорость берётся с последнего урока, а не лучшая; архивные уроки не считаются; на пустом сохранении карточка падает или показывает NaN.
    expect(bestSpeed(course)).toBe(30);
    expect(clubCard({ played: 31, goals: 70, solved: 67, course, hardKeys: [] })).toMatchObject({ matches: 31, goals: 70, tasks: 67, bestSpeed: 30, hard: [] });
    expect(clubCard({ played: 0, goals: 0, solved: 0, course: { lessons: {}, archive: {} }, hardKeys: [] })).toMatchObject({ matches: 0, goals: 0, tasks: 0, bestSpeed: 0, hard: [], minute: [] });
  });

  it('067 Т11 §6: трудных клавиш не больше трёх, без повторов и пустых, заглавными; «Минута тренера» берёт первые две', () => {
    // Ловит: четвёртая клавиша в окне; «ы» и «Ы» дважды; подпись называет все три (регрессия kk-control Р44) вместо двух.
    expect(hardKeysOf(['ы', 'Ы', ' ', 'ж', 'д', 'ф'])).toEqual(['Ы', 'Ж', 'Д']);
    expect(clubCard({ played: 0, goals: 0, solved: 0, course, hardKeys: ['ы', 'ж', 'д'] }).minute).toEqual(['Ы', 'Ж']);
  });

  it('К13 067 Т24б: Клуб показывает три худшие по точности буквы из раздела coach; порог — 50 нажатий; раздела или нажатий нет — пусто («пока нет»)', () => {
    // Ловит: берутся первые по алфавиту, а не худшие по точности; буква с 30 нажатиями (ниже порога 50) попадает в трудные; четвёртая клавиша сверх трёх; пустой раздел или `null` (старое сохранение) роняет окно; безошибочная буква считается трудной.
    const win = (miss: number, n = 60) => '1'.repeat(n - miss) + '0'.repeat(miss);
    const coach = { keys: { а: win(1), ж: win(12), д: win(8), ы: win(18), п: win(25, 30), т: win(0) } };
    expect(providedHardKeys({ coach })).toEqual(['ы', 'ж', 'д']);
    expect(clubCard({ played: 0, goals: 0, solved: 0, course, hardKeys: providedHardKeys({ coach }) }).hard).toEqual(['Ы', 'Ж', 'Д']);
    expect(providedHardKeys({ coach: { keys: { п: win(25, 30), т: win(0) } } })).toEqual([]);
    expect(providedHardKeys({ coach: { keys: {} } })).toEqual([]);
    expect(providedHardKeys({ coach: null })).toEqual([]);
    expect(providedHardKeys({})).toEqual([]);
    expect(clubCard({ played: 0, goals: 0, solved: 0, course, hardKeys: providedHardKeys({}) }).hard).toEqual([]);
  });

  it('067 Т11 §6: «На спине» — имя заглавными и номер через точку; чего нет — части нет; номер 0 не показывается', () => {
    // Ловит: «САША · 0» при пустом номере; точка-разделитель при одной части; имя строчными.
    expect(backLine('Саша', 7)).toBe('САША · 7');
    expect(backLine('Саша', 0)).toBe('САША');
    expect(backLine('', 99)).toBe('99');
    expect(backLine('  ', 0)).toBe('');
  });

  it('067 Т11 §6: смена тренера — только на другого из четырёх; тот же и чужой id клуб не меняют (двойной клик ничего не ломает)', () => {
    // Ловит: «Сменить» на текущего тренера пишет клуб заново; неизвестный id попадает в раздел `club` и ломает его проверку.
    const known = ['young', 'veteran', 'ponytail', 'bigbeard'];
    expect(swapCoach('young', 'veteran', known)).toBe('veteran');
    expect(swapCoach('young', 'young', known)).toBeNull();
    expect(swapCoach('young', 'nobody', known)).toBeNull();
  });

  it('067 Т11 §6: «Изменить» открывает окно заполненным текущим клубом; расцветка не из набора не меняется молча на другую', () => {
    // Ловит: черновик окна правки пустой («Назови клуб» сразу); «Изменить» → «Сохранить» подменяет расцветку клуба первой зелёной из набора.
    const own = { name: 'Прогресс', city: 'Тверь', coach: 'young', backName: 'САША', backNumber: 7, kit: { pattern: 'plain', body: '#1e6b34', sleeves: '#ffffff', trim: '#ffffff' } };
    // Своя расцветка — тёмно-зелёная, такой плитки в наборе нет (зелёная с белыми рукавами образца — плитка 4, 023-Р30)
    const d = draftOfClub(own, 'young');
    expect(d).toMatchObject({ name: 'Прогресс', city: 'Тверь', backName: 'САША', backNumber: 7, coach: 'young', palette: -1 });
    expect(draftProblems(d)).toEqual([]);
    expect(clubFromDraft(d).kit).toEqual(own.kit);
    const fromSet = { ...own, kit: { ...PALETTES[2]! } };
    expect(draftOfClub(fromSet, 'young').palette).toBe(2);
    expect(clubFromDraft(draftOfClub(fromSet, 'young')).kit).toEqual(PALETTES[2]);
  });
});

describe('узоры призовых и вехи на форме (067 Т13 ш6, Р158)', () => {
  /** Слой 40×40: весь корпус (R), всё непрозрачное, без тени и блика; кант и рукава — нигде. */
  function flat(zone: [number, number, number] = [255, 0, 0]): KitLayers {
    const n = 40 * 40;
    const zones = new Uint8ClampedArray(n * 4);
    const shade = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      zones.set([...zone, 255], i * 4);
      shade.set([255, 0, 255, 255], i * 4);
    }
    return { width: 40, height: 40, zones, shade };
  }
  const at = (px: Uint8ClampedArray, x: number, y: number) => [...px.slice((y * 40 + x) * 4, (y * 40 + x) * 4 + 3)];

  it('К13 узор stars: семь звёзд, у «champ» одна, у прочих узоров звёзд нет; точка в центре звезды внутри, вдали — снаружи', () => {
    // Ловит: узор призовой «в жёлтых звёздах» вернулся к простой белой; звезда считается кругом, а не пятью лучами.
    expect(starSpots('stars')).toHaveLength(7);
    expect(starSpots('champ')).toHaveLength(1);
    expect(starSpots('plain')).toHaveLength(0);
    expect(inStar(0, 0, 10)).toBe(true);
    expect(inStar(0, -9, 10)).toBe(true); // луч вверх
    expect(inStar(7, -7, 10)).toBe(false); // между лучами
  });

  it('К13 «в жёлтых звёздах»: жёлтое ложится на белую ткань только в звезде; «champ» — полоса по низу', () => {
    // Ловит: цвет звезды `alt` не доходит до холста; звёзды красят всю форму; полоса «champ» пропала.
    const kit: ClubKit = { pattern: 'stars', body: '#ffffff', alt: '#f5c400', sleeves: '#ffffff', trim: '#f5c400' };
    const out = paintKit(flat(), kit, { x0: 0, y0: 0, sx: 1 / 40, sy: 1 / 40 });
    expect(at(out, 11, 12)).toEqual([245, 196, 0]); // центр первой звезды (0,28 · 40; 0,3 · 40)
    expect(at(out, 1, 1)).toEqual([255, 255, 255]); // ткань вне звезды — белая
    const champ = paintKit(flat(), { ...kit, pattern: 'champ', alt: '#d9a520' }, { x0: 0, y0: 0, sx: 1 / 40, sy: 1 / 40 });
    expect(at(champ, 5, 37)).toEqual([217, 165, 32]); // полоса 0,9…0,935 высоты
    expect(at(champ, 5, 30)).toEqual([255, 255, 255]);
  });

  it('К13 шеврон «Бирюзы»: острие «V» белое на бирюзовом, дальше от плеча ткань бирюзовая', () => {
    // Ловит: шеврон не рисуется (форма цвета корпуса); «V» залила корпус целиком.
    const kit: ClubKit = { pattern: 'chevron', body: '#12a4a8', sleeves: '#12a4a8', trim: '#ffffff' };
    const out = paintKit(flat(), kit, { x0: 0, y0: 0, sx: 1 / 40, sy: 1 / 40 });
    expect(at(out, 20, 19)[0]).toBeGreaterThan(200); // острие (0,5 · 40; 0,47 · 40): белое
    expect(at(out, 20, 38)).toEqual(hexToRgb('#12a4a8').map((c) => Math.round(c * 255)));
    const back = paintKit(flat(), kit, { x0: 0, y0: 0, sx: 1 / 40, sy: 1 / 40, mirror: true });
    expect(at(back, 20, 19)).toEqual(hexToRgb('#12a4a8').map((c) => Math.round(c * 255))); // на спине шеврона нет
  });

  it('К13 кант вехи: золото на зелёной, белый на синей и красной (ТАБУ: жёлтое не касается синего); кант виден в зоне отделки', () => {
    // Ловит: золотой кант на синем клубе (веха 20★) — сине-жёлтое на форме; кант не доходит до ткани.
    expect(milestoneTone({ pattern: 'plain', body: '#2f9a27', sleeves: '#ffffff', trim: '#ffffff' })).toBe('gold');
    expect(milestoneTone({ pattern: 'plain', body: '#1f4fd8', sleeves: '#1f4fd8', trim: '#ffffff' })).toBe('white');
    expect(milestoneTone({ pattern: 'plain', body: '#d4202c', sleeves: '#d4202c', trim: '#ffffff' })).toBe('white');
    const blue: ClubKit = { pattern: 'plain', body: '#1f4fd8', sleeves: '#1f4fd8', trim: '#ffffff' };
    expect(yellowWithBlue({ ...blue, trim: kantTrim(blue) })).toBe(false);
    const green: ClubKit = { pattern: 'plain', body: '#2f9a27', sleeves: '#ffffff', trim: '#ffffff' };
    const out = paintKit(flat([0, 0, 255]), green, { x0: 0, y0: 0, sx: 1 / 40, sy: 1 / 40 }, { kant: true });
    expect(at(out, 3, 3)).toEqual(hexToRgb(kantTrim(green)).map((c) => Math.round(c * 255)));
    expect(at(paintKit(flat([0, 0, 255]), green, { x0: 0, y0: 0, sx: 1 / 40, sy: 1 / 40 }), 3, 3)).toEqual([255, 255, 255]); // без вехи — свой кант формы
  });

  it('К13 кант вехи на настоящей синей палитре — белый, не золото; кант вехи нигде не даёт сине-жёлтого (перебор палитр и форм альбома)', () => {
    // Ловит: кант вехи всегда золотой (золото касается синего); тон вехи не сверяется с `yellowWithBlue`.
    const blue = PALETTES.find((p) => p.body === '#2f6fe0')!;
    const out = paintKit(flat([0, 0, 255]), blue, { x0: 0, y0: 0, sx: 1 / 40, sy: 1 / 40 }, { kant: true });
    expect(at(out, 3, 3)).toEqual([255, 255, 255]);
    expect(at(out, 3, 3)).not.toEqual(hexToRgb(KANT_GOLD).map((c) => Math.round(c * 255)));
    const kits = [...PALETTES, ...KIT_IDS.map((id) => kitOf(id)?.kit).filter((k): k is ClubKit => k !== undefined)];
    for (const k of kits) expect(yellowWithBlue({ ...k, trim: kantTrim(k) }), JSON.stringify(k)).toBe(false);
  });

  it('К13 звёзды вехи на синей палитре — не золотые; на красной (ТАБУ: красное со звездой) — не рисуются, кант белый', () => {
    // Ловит: звёзды вехи всегда золотые (на синей); звёзды вехи на красной или бордо форме.
    const box = { x0: 0, y0: 0, sx: 1 / 40, sy: 1 / 40, mirror: true };
    const blue = PALETTES.find((p) => p.body === '#2f6fe0')!;
    const plain = paintKit(flat(), blue, box);
    const one = paintKit(flat(), blue, box, { stars: 1 });
    expect(at(one, 20, 3)).not.toEqual(at(plain, 20, 3)); // звезда есть
    expect(at(one, 20, 3)).not.toEqual(hexToRgb(KANT_GOLD).map((c) => Math.round(c * 255)));
    for (const body of ['#c8102e', '#7a1020']) {
      const red: ClubKit = { pattern: 'plain', body, sleeves: body, trim: '#ffffff' };
      expect(paintKit(flat(), red, box, { stars: 1 }), body).toEqual(paintKit(flat(), red, box));
      expect(paintKit(flat(), red, box, { stars: 2 }), body).toEqual(paintKit(flat(), red, box));
      expect(milestoneTone(red)).toBe('white');
    }
  });

  it('067 Т11: запись клуба «легла», если диск не принял (квота, конфликт) — окно закрывается; отказ записи — нет', () => {
    // Ловит: при квоте окно «Твой клуб» не закрывается (ребёнок застревает в нём).
    expect(stored({ ok: true })).toBe(true);
    expect(stored({ ok: false, status: 'quota' })).toBe(true);
    expect(stored({ ok: false, status: 'conflict' })).toBe(true);
    expect(stored({ ok: false, status: 'readonly' })).toBe(false);
  });

  it('К13 звёзды вехи — только на спине (одна у «Звёздной I», две у II); блик — только спереди', () => {
    // Ловит: звезда вехи нарисована спереди поверх узора; блик лёг и на спину.
    const kit: ClubKit = { pattern: 'plain', body: '#2f9a27', sleeves: '#ffffff', trim: '#ffffff' };
    const box = { x0: 0, y0: 0, sx: 1 / 40, sy: 1 / 40 };
    const plain = paintKit(flat(), kit, { ...box, mirror: true });
    const one = paintKit(flat(), kit, { ...box, mirror: true }, { stars: 1 });
    const two = paintKit(flat(), kit, { ...box, mirror: true }, { stars: 2 });
    expect(at(one, 20, 3)).not.toEqual(at(plain, 20, 3)); // звезда у верха по оси
    expect(at(two, 20, 3)).toEqual(at(plain, 20, 3)); // у II их две — по бокам от оси
    expect(at(two, 16, 3)).not.toEqual(at(plain, 16, 3));
    expect(paintKit(flat(), kit, box, { stars: 1 })).toEqual(paintKit(flat(), kit, box)); // спереди звёзд вехи нет
    expect(paintKit(flat(), kit, { ...box, mirror: true }, { sheen: true })).toEqual(plain); // блик — не на спине
    expect(paintKit(flat(), kit, box, { sheen: true })).not.toEqual(paintKit(flat(), kit, box));
  });

  it('К13 звёздный кант на форме: до 20★ нет, с 20★ есть', () => {
    // Ловит: граница вехи сдвинулась (19★ с кантом) или кант пропал совсем.
    expect(milestoneDeco(19)).toEqual({});
    expect(milestoneDeco(20)).toEqual({ kant: true });
  });
});

describe('цвет соперника (067-Р105, Т21)', () => {
  it('К8 Р105: соперник — команда двора урока: цвет c1 (при зелёном c1 — c2), при слиянии с формой клуба второй цвет; сине-жёлтого нет ни при какой расцветке', () => {
    // Ловит: форма соперника из другого места, чем фишки арены (rivalKitOf ≠ rivalBodyOf), соперник сливается с формой клуба, жёлтый соперник рядом с синим клубом.
    for (const p of clubs.palettes) {
      for (const lesson of [3, 17, 22, 32]) {
        const team = rivalOf(lesson);
        const rival = rivalKitOf(team, p);
        expect(rival.body).toBe(rivalBodyOf(team, p));
        expect(rival.trim).toBe(RIVAL_TRIM);
        expect(yellowWithBlue(rival), `${p.body} урок ${lesson}`).toBe(false);
      }
    }
    expect(rivalBodyOf(rivalOf(3), { body: '#2f9a27' })).toBe(rivalOf(3).c1); // урок 3 — «Старт», оранжевый, против зелёного клуба образца
  });

  it('К8 Р239: на всех 32 уроках и всех 9 расцветках клуба цвет соперника не сливается с основным цветом формы клуба', () => {
    // Ловит: правило сверяет не с body (красный против красного у клуба #c8102e, фиолетовый против фиолетового), а подгоняет под зелёный клуб образца.
    expect(clubs.palettes).toHaveLength(9);
    for (const p of clubs.palettes) {
      for (let lesson = 1; lesson <= 32; lesson++) {
        const team = rivalOf(lesson);
        expect(blends(rivalBodyOf(team, p), p.body), `${p.body} урок ${lesson} (${team.name})`).toBe(false);
      }
    }
  });
});
