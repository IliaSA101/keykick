/**
 * К6: порядок паков Двора и альбом (067 Т8, ТЗ-5.1, 5.2, 5.4; 049-Р3 Б′). У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { albumView, grantPrize, markShown, pendingPack } from '../../src/engine/album/award';
import { isCollected, KIT_IDS, packAt, PACKS_YARD, PARTS, PRIZE_IDS } from '../../src/engine/album/order';
import { albumDef } from '../../src/engine/album/section';
import cfg from '../../src/content/album-yard.json';
import { wear } from '../../src/engine/album/wear';
import { closePack, packExit, packView } from '../../src/app/album/input';
import { feetOf } from '../../src/app/home/team';
import { kitOf, prizeOf } from '../../src/engine/album/kit';
import { bootPairs, lockerView, lockerWear, neighbour } from '../../src/engine/album/locker';
import { lookOf } from '../../src/app/album/locker';
import { playersView } from '../../src/engine/album/players';
import { emptyForm } from '../../src/engine/form/rank';
import { markShownTo } from '../../src/engine/album/award';

const album = (packs: number, over = {}) => ({ ...albumDef.empty(), packs, shown: packs, ...over });

describe('К6: порядок паков', () => {
  it('К6: 39 паков — 13 форм по 3 части без повторов, форма каждые 3 пака, части по порядку', () => {
    // Ловит: повтор части, смешение частей разных форм, перескок формы раньше трёх паков.
    const all = Array.from({ length: PACKS_YARD }, (_, i) => packAt(i + 1)!);
    expect(new Set(all.map((p) => `${p.kit}/${p.part}`)).size).toBe(39);
    expect(all.slice(0, 3)).toEqual(PARTS.map((part) => ({ kit: KIT_IDS[0], part })));
    for (let k = 1; k <= 13; k++) expect(albumView(album(3 * k)).full).toBe(k);
    expect(albumView(album(4)).full).toBe(1);
    expect(packAt(40)).toBeNull();
    expect(packAt(0)).toBeNull();
  });

  it('К6: фольга только у форм 8–13 (ТЗ-5.4), призовых шесть, не получены по умолчанию', () => {
    // Ловит: фольга не с той формы; призовые смешаны с формами.
    const v = albumView(album(39));
    expect(v.kits.map((k) => k.foil)).toEqual(KIT_IDS.map((_, i) => i >= 7));
    expect(v.kits.every((k) => k.full)).toBe(true);
    expect(v.prize).toHaveLength(6);
    expect(v.prize.some((p) => p.have)).toBe(false);
  });

  it('К6: формы 8–13 — не раньше 22-го пака', () => {
    // Ловит: вторая половина альбома открывается раньше первой.
    expect(isCollected(21, KIT_IDS[7]!)).toBe(false);
    expect(isCollected(24, KIT_IDS[7]!)).toBe(true);
    expect(albumView(album(21)).kits.slice(7).every((k) => k.have.every((h) => !h))).toBe(true);
  });
});

describe('К6: показ пака и призы', () => {
  it('К6: перезагрузка посреди пака — пак показывается снова, пока shown < packs', () => {
    // Ловит: потерю пака при F5 (shown двигается только после показа), shown выше packs.
    const a = album(5, { shown: 4 });
    expect(pendingPack(a)).toEqual({ k: 5, item: packAt(5) });
    expect(markShown(a).shown).toBe(5);
    expect(pendingPack(markShown(a))).toBeNull();
    expect(markShown(markShown(a)).shown).toBe(5);
  });

  it('К6: призовая выдаётся один раз и только из списка', () => {
    // Ловит: дубль приза; чужой id в призах.
    const a = grantPrize(album(0), 'p-red');
    expect(grantPrize(a, 'p-red')).toBe(a);
    expect(grantPrize(a, 'nope')).toBe(a);
    expect(a.prize).toEqual(['p-red']);
  });
});

describe('К6: надеть — только собранную (ТЗ-5.2)', () => {
  it('К6: несобранная форма — отказ, альбом не меняется; собранная и призовая — надеваются; null — снять', () => {
    // Ловит: «Надеть» на неполной форме; части разных форм «в одну».
    const a = album(4);
    const no = wear(a, KIT_IDS[1]!);
    expect(no).toEqual({ ok: false, album: a, why: 'locked' });
    expect(wear(a, 'zzz')).toMatchObject({ ok: false, why: 'unknown' });
    const yes = wear(a, KIT_IDS[0]!);
    expect(yes).toMatchObject({ ok: true, album: { worn: KIT_IDS[0] } });
    expect(wear(grantPrize(a, 'p-red'), 'p-red').ok).toBe(true);
    expect(wear(yes.album, null).album.worn).toBeNull();
  });

  it('К6: check раздела — надета только собранная', () => {
    // Ловит: сохранение с надетой несобранной формой проходит проверку.
    expect(albumDef.check(album(3, { worn: KIT_IDS[0] }))).toEqual([]);
    expect(albumDef.check(album(2, { worn: KIT_IDS[0] }))).toEqual(['worn']);
    expect(albumDef.check(album(0, { prize: ['p-red'], worn: 'p-red' }))).toEqual([]);
  });
});

describe('К6: состав и порядок Двора (059: навсегда)', () => {
  it('К6: 13 форм по порядку, фольга с 8-й; `check` отвергает лишнее', () => {
    // Ловит: перестановку или переименование id форм (сломает сохранения), сдвиг фольги, пак 40+, чужой приз.
    expect(cfg.kits).toEqual(['scarlet', 'emerald', 'tangerine', 'cherry', 'magpies', 'strawberry', 'sand', 'pirates', 'ember', 'dragons', 'mint', 'tigers', 'comet']);
    expect(cfg.foilFrom).toBe(8);
    expect(albumDef.check({ ...albumDef.empty(), packs: 40, shown: 40 })).toEqual(['packs']);
    expect(albumDef.check({ ...albumDef.empty(), prize: ['p-nope'] })).toEqual(['prize']);
    expect(albumDef.check({ ...albumDef.empty(), packs: 39, shown: 39, prize: ['p-turq'] })).toEqual([]);
  });
});

describe('К6: пак на экране (067 Т12)', () => {
  it('К6 пак: части по порядку — «новая», «2 из 3», «собрана»; первая форма с фольгой — «плей-офф»', () => {
    // Ловит: сбой вида пака по номеру (новая форма принята за часть, фольга не с той формы).
    const kind = (k: number) => packView(album(k, { shown: k - 1 }))!.kind;
    expect([kind(1), kind(2), kind(3)]).toEqual(['new', 'part', 'full']);
    expect(kind(21)).toBe('full');
    expect(kind(22)).toBe('foil');
    expect(kind(23)).toBe('part');
    expect(kind(25)).toBe('new'); // плей-офф — только первая форма с фольгой, вторая обычная «новая»
    expect(packView(album(22, { shown: 22 }))).toBeNull();
  });

  it('К6 каждая форма порядка есть в `kits.json`: `packView` не даёт `null` посреди альбома', () => {
    // Ловит: id формы в `album-yard.json` без записи в `kits.json` — пак молча пропал бы, экран увёл бы мимо цепочки.
    expect(KIT_IDS.every((id) => kitOf(id) !== null)).toBe(true);
    for (let k = 1; k <= PACKS_YARD; k++) expect(packView(album(k, { shown: k - 1 })), `пак ${k}`).not.toBeNull();
  });

  it('К6 Esc и «Позже»: закрытый пак — Дом без записи; открытый любого вида — показан; «Форма собрана» продолжает цепочку без надевания', () => {
    // Ловит: пак, оставшийся непоказанным после Esc на открытом; «Позже», обрывающее цепочку в Дом или надевающее форму; Enter на закрытом, что-то пишущий.
    const none = { mark: false, wear: false, go: 'home' };
    expect(packExit('closed', 'new', 'esc')).toEqual(none);
    expect(packExit('opening', 'full', 'esc')).toEqual(none);
    for (const kind of ['new', 'part', 'foil'] as const) expect(packExit('shown', kind, 'esc')).toEqual({ mark: true, wear: false, go: 'home' });
    expect(packExit('shown', 'full', 'esc')).toEqual({ mark: true, wear: false, go: 'chain' });
    expect(packExit('shown', 'full', 'enter')).toEqual({ mark: true, wear: true, go: 'chain' });
    expect(packExit('shown', 'part', 'enter')).toEqual({ mark: true, wear: false, go: 'chain' });
    expect(packExit('closed', 'new', 'enter')).toBeNull();
    expect(packExit('opening', 'new', 'enter')).toBeNull();
  });

  it('К6 вторая вкладка: «Надеть» и «Позже» молчат, «Дальше» и Esc — Дом без записи', () => {
    // Ловит: запись или надевание формы из вкладки, где сохранение не ведётся (как в Лавке).
    expect(packExit('shown', 'full', 'enter', false)).toBeNull();
    expect(packExit('shown', 'full', 'esc', false)).toEqual({ mark: false, wear: false, go: 'home' });
    expect(packExit('shown', 'part', 'enter', false)).toEqual({ mark: false, wear: false, go: 'home' });
  });

  it('К6 два пака подряд: после «Дальше» показан следующий, Esc на открытом ничего не теряет', () => {
    // Ловит: накопившиеся паки (Esc или «Дом» на итоге), которые цепочка показывала по одному за победу, а лишние висели непоказанными.
    let a = album(5, { shown: 2 });
    const seen: number[] = [];
    for (let v = packView(a); v !== null; v = packView(a)) {
      seen.push(v.k);
      const x = packExit('shown', v.kind, 'enter')!;
      a = closePack(a, v, x.wear);
    }
    expect(seen).toEqual([3, 4, 5]);
    expect(a.worn).toBe(KIT_IDS[0]); // пак 3 — «собрана», Enter надел
    const b = album(5, { shown: 3 });
    const x = packExit('shown', packView(b)!.kind, 'esc')!;
    expect(x.mark && packView(closePack(b, packView(b)!, x.wear))?.k).toBe(5);
  });

  it('К6 пак 39: последняя форма — «собрана», дальше паков нет', () => {
    // Ловит: пак после 39-го (ТЗ-5.1: во Дворе 39 паков), потерю последней формы.
    const v = packView(album(39, { shown: 38 }))!;
    expect(v.kit.id).toBe(KIT_IDS.at(-1));
    expect(v.kind).toBe('full');
    expect(v.total).toEqual({ parts: 39, of: 39, full: 13, forms: 13 });
    expect(packView(album(39, { shown: 39 }))).toBeNull();
  });

  it('К6 двойной Enter: «Дальше» дважды — показан один пак, не два', () => {
    // Ловит: пропуск пака на повторном Enter (shown растёт на 1 при каждом нажатии).
    const a = album(5, { shown: 3 });
    const v = packView(a)!;
    const once = closePack(a, v, false);
    expect(once.shown).toBe(4);
    expect(closePack(once, v, false)).toBe(once);
    expect(markShownTo(a, 99)).toBe(a);
    expect(markShownTo(a, 2)).toBe(a);
  });

  it('К6 «Надеть»: собранная форма надета, несобранная — нет; «Позже» не надевает', () => {
    // Ловит: надеть несобранную форму (ТЗ-5.2), надевание на «Позже».
    const full = album(3, { shown: 2 });
    expect(closePack(full, packView(full)!, true).worn).toBe(KIT_IDS[0]);
    expect(closePack(full, packView(full)!, false).worn).toBeNull();
    const part = album(2, { shown: 1 });
    expect(closePack(part, packView(part)!, true).worn).toBeNull();
  });
});

describe('К6: Раздевалка (067 Т13, ТЗ-5.2, 5.7)', () => {
  it('К6 Раздевалка: несобранная форма — «Надеть» нет, «ещё k урока»; собранная — можно; надетая — отмечена', () => {
    // Ловит: «Надеть» у несобранной (К-З3), неверный счёт «ещё k», потерю метки «на тебе».
    const v = lockerView(album(4, { worn: KIT_IDS[0] }));
    expect(v.kits).toHaveLength(13);
    expect(v.kits[0]).toMatchObject({ state: 'worn', need: 0, have: [true, true, true] });
    expect(v.kits[1]).toMatchObject({ state: 'locked', need: 2, have: [true, false, false] });
    expect(v.kits[2]).toMatchObject({ state: 'locked', need: 5 });
    expect(v.clubWorn).toBe(false);
    expect(lockerView(album(3)).kits[0]!.state).toBe('wearable');
    expect(lockerView(album(0)).clubWorn).toBe(true);
    expect(v.viewable).toEqual([KIT_IDS[0]]);
  });

  it('К6 Раздевалка: призовые — все 6 (Р136), полученные надеваются, неполученные закрыты; фольга — у форм второй половины', () => {
    // Ловит: пропавшие неполученные призовые (ребёнок не видит, что добыть), «Надеть» у неполученной, фольгу не у тех форм.
    const none = lockerView(album(10)).prizes;
    expect(none.map((p) => p.id)).toEqual(PRIZE_IDS);
    expect(none.every((p) => p.state === 'locked' && p.have.every((x) => !x))).toBe(true);
    const v = lockerView(album(39, { prize: ['p-star1', 'p-champ'], worn: 'p-champ' }));
    expect(v.prizes.map((p) => [p.id, p.state])).toEqual(PRIZE_IDS.map((id) => [id, id === 'p-star1' ? 'wearable' : id === 'p-champ' ? 'worn' : 'locked']));
    expect(v.kits.map((k) => k.foil)).toEqual(KIT_IDS.map((_, i) => i >= 7));
    expect(v.full).toBe(13);
  });

  it('К13 Раздевалка: счёт шапки стенда (Э2К.11) — части и формы из паков, фольга с 8-й формы', () => {
    // Ловит: «17 из 39 частей» и «формы 8–13 — с фольгой» не из модели (расхождение с кадром), счёт частей по призовым, фольгу не с той формы.
    const v = lockerView(album(17, { prize: ['p-red'] }));
    expect([v.parts, v.total, v.full, v.foilFrom, v.kits.length]).toEqual([17, 39, 5, 8, 13]);
    expect(lockerView(album(0)).parts).toBe(0);
    expect(lockerView(album(99)).parts).toBe(39);
  });

  it('К6 Раздевалка: бутсы — кеды есть всегда, надета лучшая купленная пара; чужие id не считаются (067-Р155)', () => {
    // Ловит: пусто до покупки (на кадре Э2К.11 строка «Бутсы» не пуста), надеты кеды при купленных «коробке» и «дворовых», выдуманная пара из чужого id.
    expect(bootPairs([])).toEqual([{ id: 'basic', worn: true }]);
    expect(bootPairs(['boots-yard', 'garland'])).toEqual([{ id: 'basic', worn: false }, { id: 'yard', worn: true }]);
    expect(bootPairs(['boots-box', 'boots-yard']).map((b) => [b.id, b.worn])).toEqual([['basic', false], ['yard', false], ['box', true]]);
    expect(bootPairs(['boots-box']).map((b) => b.id)).toEqual(['basic', 'box']);
    expect(feetOf(['boots-box', 'boots-yard'])).toBe('x'); // та же «лучшая пара», что на поле (app/home/team)
  });

  it('К6 «Надеть» в Раздевалке: несобранная — отказ без записи; двойной Enter — второй раз без изменений; сила и паки не трогаются (К-З5)', () => {
    // Ловит: надеть несобранную, второй «Надеть» как изменение (лишняя запись), побочные поля раздела.
    const a = album(4);
    const bad = lockerWear(a, KIT_IDS[1]!);
    expect(bad).toMatchObject({ ok: false, why: 'locked', changed: false });
    expect(bad.album).toBe(a);
    const first = lockerWear(a, KIT_IDS[0]!);
    expect(first).toMatchObject({ ok: true, changed: true });
    expect(first.album).toEqual({ ...a, worn: KIT_IDS[0] });
    expect(lockerWear(first.album, KIT_IDS[0]!).changed).toBe(false);
    expect(lockerWear(first.album, null)).toMatchObject({ ok: true, changed: true });
    expect(lockerWear(a, 'нет-такой')).toMatchObject({ ok: false, why: 'unknown' });
    expect(lockerWear(album(39, { prize: ['p-red'] }), 'p-red')).toMatchObject({ ok: true, changed: true });
    expect(lockerWear(album(39), 'p-red')).toMatchObject({ ok: false, why: 'locked' });
  });

  it('К6 «Рассмотреть»: ← → по кругу собранных форм; одна — на месте; нет — null', () => {
    // Ловит: выход за край списка, пустой список.
    const ids = ['a', 'b', 'c'];
    expect(neighbour(ids, 'a', -1)).toBe('c');
    expect(neighbour(ids, 'c', 1)).toBe('a');
    expect(neighbour(ids, 'b', 1)).toBe('c');
    expect(neighbour(['a'], 'a', 1)).toBe('a');
    expect(neighbour([], 'a', 1)).toBeNull();
    expect(neighbour(ids, 'zz', 1)).toBe('a');
  });

  it('К6 призовые формы: у каждой есть имя и причина «За …» (ТЗ-5.5); не призовая — null', () => {
    // Ловит: призовой id без записи в `prizes.json`.
    for (const id of PRIZE_IDS) {
      const p = prizeOf(id);
      expect(p, id).not.toBeNull();
      expect(p!.why.startsWith('За ')).toBe(true);
    }
    expect(prizeOf('scarlet')).toBeNull();
    expect(prizeOf('p-star1')!.kit).toBeNull();
    expect(prizeOf('p-turq')!.kit).not.toBeNull();
    expect(Object.keys(lookOf('p-star1', prizeOf('p-turq')!.kit!).deco)).not.toEqual([]); // отделка вехи доходит до экрана
  });
});

describe('К6: игроки (067 Т13, ТЗ-5.11, 5.12)', () => {
  const win = (ones: number, n: number): string => '1'.repeat(ones) + '0'.repeat(n - ones);
  it('К6 игроки: 8 карточек в порядке клавиатуры, приход по урокам, «набор N/300» до 50 нажатий', () => {
    // Ловит: порядок Ф Ы В А | О Л Д Ж, приход не по урокам, число при коротком окне.
    const cards = playersView(emptyForm(), 3);
    expect(cards.map((c) => c.key).join('')).toBe('ФЫВАОЛДЖ');
    expect(cards.filter((c) => c.here).map((c) => c.key).join('')).toBe('ВАОЛ');
    expect(cards.every((c) => c.rank === 0 && c.acc === null && c.fill === 0)).toBe(true);
    const f = { fingers: { li: { w: '1'.repeat(40), max: 0, cand: { rank: 0, n: 0 } } } };
    expect(playersView(f, 3).find((c) => c.key === 'А')).toMatchObject({ acc: null, n: 40, window: 300 });
  });

  it('К6 игроки: полоса — между порогом своего ранга и следующего; ранг не падает; звезда — полная', () => {
    // Ловит: полосу от нуля вместо порога ранга, падение ранга при просадке, пустую полосу у звезды.
    const fingers = {
      lp: { w: win(135, 150), max: 0, cand: { rank: 0, n: 0 } },
      lr: { w: win(143, 150), max: 1, cand: { rank: 0, n: 0 } },
      lm: { w: win(130, 150), max: 2, cand: { rank: 0, n: 0 } },
      li: { w: win(150, 300), max: 4, cand: { rank: 0, n: 0 } },
    };
    const by = (k: string) => playersView({ fingers }, 99).find((c) => c.key === k)!;
    expect(by('Ф')).toMatchObject({ acc: 90, fill: 1, next: 90, kept: false });
    expect(by('Ы')).toMatchObject({ rank: 1, kept: false, next: 95 });
    expect(by('В')).toMatchObject({ rank: 2, kept: true, fill: 0, next: 97 });
    expect(by('А')).toMatchObject({ rank: 4, fill: 1, next: null, kept: true });
  });
});
