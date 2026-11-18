/**
 * Первый запуск (063 Т6а, К10): шаги, черновик клуба, расцветки и перекраска формы. У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import clubs from '../../src/content/clubs.json';
import { hexToRgb, paintKit, patternAt, yellowWithBlue, type KitLayers } from '../../src/engine/club/paint';
import { NEUTRAL_DARK, NEUTRAL_LIGHT, opaqueBox, outfitFor, paintZones } from '../../src/engine/club/outfit';
import { crowdHue, recolorCrowd } from '../../src/engine/club/crowd';
import { clubDef, type ClubKit } from '../../src/engine/club/section';
import { PALETTES, clubFromDraft, cityHints, defaultDraft, draftProblems, dmy, loadCheck, nextStep, numberDigits, numberOf, playerNameOf, coachEnter, shortVersion, badReason, coachNameOf, restoreFile } from '../../src/engine/club/start';
import { factLine, fileLine } from '../../src/components/club/restoreLines';
import type { Device } from '../../src/engine/save/device';
import { createPlayer, writePlayer } from '../../src/engine/save/envelope';
import { planImport } from '../../src/engine/save/import';
import { makeSnapshot, serializeSnapshot } from '../../src/engine/save/snapshot';
import { SECTIONS } from '../../src/app/save/sections';

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
