/**
 * Витрина матча v2 (спека 017, Т6–Т7, src/dev/match): сцены доводят машину до нужной фазы и итога.
 * Отдельный файл — своя подготовка (dev-витрина), а не подставные тексты match-flow.
 */
import { describe, expect, it } from 'vitest';
import { rules } from '../src/dev/match/driver';
import { earn, untilCoin } from '../src/engine/matchResult/coins';
import { matchView } from '../src/engine/match/view';

describe('витрина экрана матча (Т6, src/dev/match)', () => {
  // Витрина — единственный способ увидеть все фазы экрана без прохода матча; тест держит её рабочей.
  it('каждая сцена приводит машину в свою фазу, а мячи запаса и подписи — по design §2', async () => {
    // Ловит: сцену, что не доходит до фазы (кадры тогда снимают не то), подпись мячей не по границе e = g.
    const { lessonById } = await import('../src/dev/match/driver');
    const { scenes } = await import('../src/dev/match/scenes');
    const l = lessonById('yard-05');
    const view = (id: string) => matchView(scenes[id]!(l));
    const want: Record<string, string> = {
      intro: 'intro', warmup: 'warmup', half1: 'half1', break: 'break', half2: 'half2', kick: 'kick',
      extra: 'extra', coach: 'coach', win: 'result', loss: 'result', passed: 'result', paused: 'half1', decisive: 'half2',
    };
    for (const [id, phase] of Object.entries(want)) expect(view(id).phase, id).toBe(phase);
    expect(view('paused').paused).toBe(true);
    expect(view('decisive').decisive).toBe(true);
    expect(view('half1').decisive).toBe(false);
    // Мячей c − 1; e = 0 → «ещё g», e = g → «дальше без ошибок», e > g → подписи нет, цветной мяч не горит.
    expect(view('reserve-e0').reserve).toMatchObject({ total: l.c - 1, left: l.c - 1, hint: { kind: 'more', n: l.g } });
    expect(view('reserve-eg').reserve).toMatchObject({ left: l.c - 1 - l.g, hint: { kind: 'last' }, goalLit: 0 });
    expect(view('reserve-over').reserve).toMatchObject({ hint: { kind: 'none' }, goalLit: 0 });
    expect(view('intro').reserve).toBeNull();
    expect(view('break').reserve).toBeNull();
  });
});

// Каждая сцена итога должна дойти до итога и дать нужные кнопки и потолок звёзд (design §3, §4, 017-Р12).
async function model(id: string) {
  const { lessonById } = await import('../src/dev/match/driver');
  const { scenes } = await import('../src/dev/match/scenes');
  const { extrasOf } = await import('../src/dev/match/extras');
  const { resultModel } = await import('../src/engine/matchResult/resultModel');
  const state = scenes[id]!(lessonById('yard-05'));
  const info = matchView(state).result!;
  const x = extrasOf(state, id);
  return { state, info, x, m: resultModel(info, x) };
}
const ids = (m: { buttons: { id: string }[] }): string[] => m.buttons.map((b) => b.id);

describe('витрина итога матча (Т7, src/dev/match + components/match + matchResult)', () => {
  it('победа: ★★★ без пропущенных; ★ с пропущенным и подсказкой до ★★; кнопка одна — «Дальше»', async () => {
    // Ловит: звёзды не по design §3, потерю подсказки «чего не хватило», лишние кнопки у пройденного матча.
    const win3 = await model('win-3');
    expect(win3.m).toMatchObject({ kind: 'win', stars: 3, newStars: 3, cap: 3, why: null, stuck: false });
    expect(ids(win3.m)).toEqual(['next']);
    const win1 = await model('win-1');
    expect(win1.m).toMatchObject({ kind: 'win', stars: 1, why: { kind: 'toTwo' } });
    expect(ids(win1.m)).toEqual(['next']);
  });

  it('пример ТЗ-2.6: 1:1 печатью и пенальти — пройден, звёзд 0, объяснено, что звезду дают голы печатью', async () => {
    // Ловит: звезду за победу на пенальти и итог «Не в этот раз» для пройденного матча.
    const { state, info, m } = await model('penalty-pass');
    expect(state.score).toEqual({ typed: 1, kick: 1, conceded: 1 });
    expect(info.verdict).toMatchObject({ passed: true, typedWin: false, stars: 0 });
    expect(m).toMatchObject({ kind: 'penalty', stars: 0, goals: 2, conceded: 1, why: { kind: 'typedOnly' } });
    expect(ids(m)).toEqual(['next']);
  });

  it('поражение: fails 1/2/3/5 — те кнопки и в том порядке (017-Р12), у помощи потолок звёзд в подписи', async () => {
    // Ловит: Enter по привычке на «С тренером» вместо «С запасом», кнопку помощи без потолка, потерю «чего не хватило».
    const l1 = await model('loss-1');
    expect(l1.info.fails).toBe(1);
    expect(ids(l1.m)).toEqual(['replay']);
    // loss-1 — проигрыш всех атак: разрыв больше двух голов, вместо числа — ободрение (017-Р49).
    expect(l1.m.why).toEqual({ kind: 'nextTry' });
    expect(ids((await model('loss-1-half2')).m)).toEqual(['replay2']);
    const l2 = await model('loss-2');
    expect(l2.info).toMatchObject({ fails: 2, offer: { coachMinute: true } });
    expect(ids(l2.m)).toEqual(['replay']);
    const l3 = await model('loss-3');
    expect(l3.info.fails).toBe(3);
    expect(l3.m.buttons).toEqual([{ id: 'reserve', stars: rules.help.reserveCap }, { id: 'again', stars: 0 }, { id: 'quit', stars: 0 }]);
    expect(l3.m.stuck).toBe(true);
    const l5 = await model('loss-5');
    expect(l5.info.fails).toBe(5);
    expect(l5.m.buttons).toEqual([{ id: 'coach', stars: rules.help.coachCap }, { id: 'reserve', stars: rules.help.reserveCap }, { id: 'quit', stars: 0 }]);
    expect(l5.m.kind).toBe('loss');
    expect(l5.m.stars).toBe(0);
  });

  it('с помощью: потолок ★★ («с запасом») и ★ («с тренером»), в итоге объяснено', async () => {
    // Ловит: ★★★ за матч с помощью (ТЗ-2.9) и итог без пояснения, почему звёзд меньше.
    const reserve = await model('help-reserve');
    expect(reserve.state.help).toBe('reserve');
    expect(reserve.m).toMatchObject({ kind: 'win', stars: rules.help.reserveCap, cap: rules.help.reserveCap, why: { kind: 'capHelp', cap: rules.help.reserveCap } });
    const coach = await model('help-coach');
    expect(coach.state.help).toBe('coach');
    expect(coach.m).toMatchObject({ kind: 'win', stars: rules.help.coachCap, cap: rules.help.coachCap, why: { kind: 'capHelp', cap: rules.help.coachCap } });
  });

  it('монеты и форма: «N верных → M монет», «до монеты ещё K»; показывается только рост; отчёт — на контрольных', async () => {
    // Ловит: расхождение «512 / 20» без остатка, падение формы в показе, отчёт на обычном уроке.
    const win = await model('win-3');
    const { coins } = win.m;
    expect(coins.correct).toBeGreaterThan(0);
    // Монеты — по `earn` от числа верных, которое насчитала машина (остаток кошелька до матча в витрине — 8).
    const typed = [win.state.first, win.state.second, win.state.extra].reduce((n, p) => n + (p?.correct ?? 0), 0);
    expect(coins.correct).toBe(typed);
    expect(coins.coins).toBe(earn(8, typed, rules.coinPer).coins);
    expect(coins.left).toBe(untilCoin(win.x.carry, rules.coinPer));
    expect(win.m.growth).toEqual([]);
    expect(win.m.report).toBeNull();
    const growth = await model('growth');
    // Состав по порядку: lp — только +2 % без смены ранга, li — ранг и +4 %, rr — ранг без процентов (в окне не было базы).
    expect(growth.m.growth.map((g) => [g.finger, g.from, g.rank, g.percent])).toEqual([['lp', 0, 0, 2], ['li', 1, 2, 4], ['rr', 0, 1, 0]]);
    for (const g of growth.m.growth) expect(g.rank > g.from || g.percent > 0).toBe(true);
    const report = await model('report');
    expect(report.m.report).toHaveLength(rules.squad.length);
  });

  it('пояснения: товарищеский (passed), «до ★★★ не хватило точности», «этот матч был полегче»; stuck только с 3-го провала', async () => {
    // Ловит: товарищеский урок без вида «пройден», потерю подсказки про точность при ★★ без пропущенных, смягчение без пояснения
    // и предложение «помощь — не позор» ребёнку после 1–2 провалов.
    const { configOf, lessonById, play, SEED } = await import('../src/dev/match/driver');
    const { extrasOf } = await import('../src/dev/match/extras');
    const { resultModel } = await import('../src/engine/matchResult/resultModel');
    const { initMatch } = await import('../src/engine/match/machine');
    const passed = await model('passed');
    expect(passed.info.verdict).toMatchObject({ passed: true, couldBeBetter: true, stars: 0 });
    expect(passed.m).toMatchObject({ kind: 'passed', why: { kind: 'couldBeBetter' } });
    expect(ids(passed.m)).toEqual(['next']);

    const l = lessonById('yard-05');
    const sloppy = play(initMatch(configOf(l), { seed: SEED, fails: 0 }), (s) => s.phase === 'result', () => l.g);
    const three = resultModel(matchView(sloppy).result!, extrasOf(sloppy, 'x'));
    expect(three).toMatchObject({ kind: 'win', stars: 2, why: { kind: 'toThree', percent: Math.round(rules.threeStar * 100) } });

    const soft = play(initMatch({ ...configOf(l), softened: true }, { seed: SEED, fails: 0 }), (s) => s.phase === 'result');
    const capped = resultModel(matchView(soft).result!, extrasOf(soft, 'x'));
    expect(capped).toMatchObject({ kind: 'win', stars: rules.help.softenCap, cap: rules.help.softenCap, why: { kind: 'capSoften', cap: rules.help.softenCap } });

    expect((await model('loss-1')).m.stuck).toBe(false);
    expect((await model('loss-2')).m.stuck).toBe(false);
  });

  it('«Капитан вернулся» — вступление; подписи кнопок с потолком звёзд дословно (первая — выделенная)', async () => {
    // Ловит: сцену, что не доходит до вступления, подпись помощи без потолка «★», сбитый порядок кнопок.
    const { lessonById } = await import('../src/dev/match/driver');
    const { scenes } = await import('../src/dev/match/scenes');
    expect(matchView(scenes['comeback']!(lessonById('yard-05'))).phase).toBe('intro');
    const { buttonLabel, whyText } = await import('../src/components/matchResult/labels');
    const labels = async (id: string) => (await model(id)).m.buttons.map(buttonLabel);
    expect(await labels('loss-5')).toEqual(['С тренером\u00a0★', 'С запасом\u00a0★★', 'На сегодня хватит']);
    expect(await labels('loss-3')).toEqual(['С запасом\u00a0★★', 'Ещё раз', 'На сегодня хватит']);
    expect(await labels('loss-1')).toEqual(['Переиграть матч']);
    expect(await labels('loss-1-half2')).toEqual(['Переиграть тайм']);
    expect(await labels('win-3')).toEqual(['Дальше']);
    // Склонение «верных» (Р26-ревью): «1 верное → 0 монет», «21 верное», «Ещё 1 верное — и монета».
    const { correctWord } = await import('../src/components/matchResult/labels');
    expect([0, 1, 2, 5, 11, 21, 22, 512].map(correctWord)).toEqual(['верных', 'верное', 'верных', 'верных', 'верных', 'верное', 'верных', 'верных']);
    expect(whyText((await model('win-1')).m.why)).toBe('До\u00a0★★ не хватило: без пропущенных голов.');
    expect(whyText((await model('penalty-pass')).m.why)).toContain('пенальти');
    expect(whyText((await model('help-reserve')).m.why)).toContain('не выше\u00a0★★');
  });
});

describe('доправка по кадрам тестировщика и ребёнка-критика (017-Р30–Р33)', () => {
  it('проигрыш: «Не беда!», «Ещё N голов — и победа» со склонением, «Ещё K верных — и монета»', async () => {
    // Ловит: возврат «Не в этот раз» и «До победы не хватило», потерю склонения (1 гол, 2 гола, 5 голов, 21 гол) и «До монеты ещё K».
    const { ru } = await import('../src/i18n/ru');
    const { whyText, coinLeft } = await import('../src/components/matchResult/labels');
    expect(ru.match2Result.title.loss).toBe('Не беда!');
    const text = (n: number) => whyText({ kind: 'goals', n });
    expect([1, 2, 5, 11, 21, 22].map(text)).toEqual([
      'Ещё 1 гол — и победа', 'Ещё 2 гола — и победа', 'Ещё 5 голов — и победа',
      'Ещё 11 голов — и победа', 'Ещё 21 гол — и победа', 'Ещё 22 гола — и победа',
    ]);
    expect([1, 3, 8, 21].map(coinLeft)).toEqual([
      'Ещё 1 верное — и монета', 'Ещё 3 верных — и монета', 'Ещё 8 верных — и монета', 'Ещё 21 верное — и монета',
    ]);
  });

  it('«Ещё N голов — и победа» только при разнице до двух голов, дальше — строка про следующую попытку (017-Р49)', async () => {
    // Ловит: «Ещё 9 голов — и победа» после 0:8 (звучит приговором) и сдвиг порога: 1 и 2 гола — по-прежнему число.
    const { resultModel, NEAR_GOALS } = await import('../src/engine/matchResult/resultModel');
    const { whyText } = await import('../src/components/matchResult/labels');
    const { info, x } = await model('loss-1');
    const why = (conceded: number) => resultModel({ ...info, score: { typed: 0, kick: 0, conceded } }, x).why;
    expect(NEAR_GOALS).toBe(2);
    // typed 0, kick 0, conceded c → до победы c + 1 гол.
    expect([0, 1].map(why)).toEqual([{ kind: 'goals', n: 1 }, { kind: 'goals', n: 2 }]);
    expect([2, 3, 8].map(why)).toEqual([{ kind: 'nextTry' }, { kind: 'nextTry' }, { kind: 'nextTry' }]);
    const text = whyText(why(8)) ?? '';
    expect(text).toBe('Со следующей попытки пойдёт легче: урок уже знакомый.');
    expect(text).not.toMatch(/\d/);
  });

  it('подсказка «Enter — первая кнопка, Tab — другая» только при двух и больше кнопках', async () => {
    // Ловит: подсказку про Tab при единственной кнопке («Переиграть матч») — Tab там некуда идти.
    const keys = async (id: string) => (await model(id)).m.keysHint;
    expect(await keys('loss-1')).toBe(false);
    expect(await keys('loss-1-half2')).toBe(false);
    expect(await keys('loss-3')).toBe(true);
    expect(await keys('loss-5')).toBe(true);
  });

  it('звёзды в подписях не отрываются от слова: перед каждой серией ★ — неразрывный пробел', async () => {
    // Ловит: перенос «★★» на новую строку отдельно от «до» / «—» в кнопках помощи и в пояснениях.
    const { buttonLabel, whyText } = await import('../src/components/matchResult/labels');
    const texts: string[] = [];
    for (const id of ['loss-3', 'loss-5', 'win-1', 'help-reserve', 'help-coach']) {
      const { m } = await model(id);
      texts.push(...m.buttons.map(buttonLabel), whyText(m.why) ?? '');
    }
    const withStars = texts.filter((x) => x.includes('★'));
    expect(withStars.length).toBeGreaterThanOrEqual(4);
    // Первая звезда серии без неразрывного пробела перед ней — перенос возможен.
    for (const x of withStars) expect(x, x).not.toMatch(/(?<![★\u00a0])★/u)
  });

  it('вступление: три строки (две без сейва), числа по порогам урока, без «сейв» и пенальти', async () => {
    // Ловит: возврат слова «сейв» и строки про пенальти во вступление, строку про вратаря при c − g = 1, потерю склонения «ошибка/ошибки».
    const { introRules } = await import('../src/components/match/labels');
    expect(introRules(1, 5).map((r) => [r.kind, r.text])).toEqual([
      ['goal', '0–1 ошибка — гол'], ['save', '2–4 — вратарь отбил'], ['conceded', '5 и больше — гол соперника'],
    ]);
    expect(introRules(2, 4).map((r) => r.text)).toEqual(['0–2 ошибки — гол', '3 — вратарь отбил', '4 и больше — гол соперника']);
    expect(introRules(0, 3).map((r) => r.text)).toEqual(['Без ошибок — гол', '1–2 — вратарь отбил', '3 и больше — гол соперника']);
    expect(introRules(1, 2).map((r) => r.kind)).toEqual(['goal', 'conceded']);
    expect(introRules(5, 9)[0]!.text).toBe('0–5 ошибок — гол');
    for (const r of [introRules(1, 5), introRules(1, 2)].flat()) expect(r.text).not.toMatch(/сейв|пенальти/i);
  });

  it('диктор запаса ошибок — только подпись, без «Запас ошибок: N»', async () => {
    // Ловит: возврат «Запас ошибок: 2» в зачитываемый текст матча v2 (подпись над мячами уже говорит всё нужное).
    const { reserveHintText } = await import('../src/components/match/labels');
    expect(reserveHintText({ kind: 'more', n: 1 })).toBe('Можно ошибиться ещё 1 — гол твой');
    expect(reserveHintText({ kind: 'last' })).toBe('Дальше без ошибок — гол твой');
    expect(reserveHintText({ kind: 'none' })).toBe('');
    expect(reserveHintText(undefined)).toBe('');
  });

  it('подписи табло: перерыв, минута тренера, пенальти; пенальти знает подпись «Введи ответ и нажми Enter»', async () => {
    // Ловит: потерю подписи табло при переносе в labels и подписи пенальти.
    const { captionOf } = await import('../src/components/match/labels');
    const { ru } = await import('../src/i18n/ru');
    const { lessonById } = await import('../src/dev/match/driver');
    const { scenes } = await import('../src/dev/match/scenes');
    const cap = (id: string) => captionOf(matchView(scenes[id]!(lessonById('yard-05'))));
    expect(cap('break')).toBe('Перерыв');
    expect(cap('coach')).toBe('Минута тренера');
    expect(cap('kick')).toBe('2-й тайм · Пенальти');
    expect(cap('half1')).toMatch(/^1-й тайм · Атака \d+ из \d+$/);
    expect(ru.match2.kick.answerHint).toBe('Введи ответ и нажми Enter');
  });
});

describe('второй взгляд ребёнка-критика (017-Р34)', () => {
  it('кнопки итога — до 20 знаков (одна строка на 1024), «вернёшься за звёздами» не в кнопке', async () => {
    // Ловит: возврат длинных подписей («С тренером — ★, вернёшься за звёздами», «Переиграть 2-й тайм»), что на 1024 переносятся на 2–3 строки.
    const { buttonLabel, buttonNote } = await import('../src/components/matchResult/labels');
    const { ru } = await import('../src/i18n/ru');
    for (const id of ['loss-1', 'loss-1-half2', 'loss-3', 'loss-5', 'win-3', 'help-reserve', 'help-coach']) {
      for (const b of (await model(id)).m.buttons) {
        const label = buttonLabel(b);
        expect(label.length, label).toBeLessThanOrEqual(20);
        expect(label, label).not.toMatch(/вернёшься/);
      }
    }
    // Пояснение звёзд — под самой кнопкой помощи (017-Р49), абзаца «за звёздами вернёшься» внизу больше нет.
    expect('coachNote' in ru.match2Result.stuck).toBe(false);
    const l5 = (await model('loss-5')).m.buttons;
    expect(l5.map((b) => b.id)).toEqual(['coach', 'reserve', 'quit']);
    expect(l5.map(buttonNote)).toEqual(['звёзды:\u00a0до\u00a0★', 'звёзды:\u00a0до\u00a0★★', null]);
    expect((await model('loss-3')).m.buttons.map(buttonNote).filter(Boolean)).toHaveLength(1);
    expect((await model('loss-1')).m.buttons.map(buttonNote)).toEqual([null]);
  });

  it('заработанное: монеты — строкой, копилка только при нуле монет, болельщики — числом без слова', async () => {
    // Ловит: копилку «Ещё K верных» рядом с заработанными монетами (на победе её нет), слово «болельщика» на экране вместо значка.
    const { earnedLine, fansLabel } = await import('../src/components/matchResult/labels');
    expect(earnedLine({ paid: true, coins: 25, left: 3 })).toEqual({ kind: 'coins', coins: 25, word: 'монет' });
    expect(earnedLine({ paid: true, coins: 1, left: 3 })).toMatchObject({ kind: 'coins', word: 'монета' });
    expect(earnedLine({ paid: true, coins: 0, left: 8 })).toEqual({ kind: 'piggy', text: 'Ещё 8 верных — и монета' });
    expect(earnedLine({ paid: false, coins: 0, left: 8 })).toEqual({ kind: 'unpaid', text: 'За этот урок монет нет.' });
    expect(fansLabel(512)).toBe('512 болельщиков');
    expect(fansLabel(1)).toBe('1 болельщик');
    // Победа на реальном уроке: монеты есть → копилки в строке нет.
    const win = (await model('win-3')).m.coins;
    if (win.coins > 0) expect(earnedLine(win).kind).toBe('coins');
  });

  it('кадр match2-draw снимается с уроком yard-05 (иначе проигрыш 0:8)', async () => {
    // Ловит: кадр «ничья» без урока — без сейва в уроке по умолчанию ничьей не бывает.
    const { FRAMES } = await import('../src/dev/frames');
    const draw = FRAMES.find((f) => f.id === 'match2-draw');
    expect(draw?.path).toContain('lesson=yard-05');
    expect(draw?.path).toContain('at=draw');
  });
});
