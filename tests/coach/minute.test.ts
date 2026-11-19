/**
 * Минута тренера (К1, ТЗ-2.9, 3.4): две клавиши, строки пар, конец на конце строки после `coach.ms`, итог — нажатия и верные.
 */
import { describe, expect, it } from 'vitest';
import { applyKeys, hardKeys, keyTile, type KeyTile } from '../../src/engine/coach/keys';
import { coachDef, emptyCoach, type CoachKeys } from '../../src/engine/coach/section';
import { emptyForm } from '../../src/engine/form/rank';
import { clockText, endMinute, minuteOf, tileLine } from '../../src/app/coach/run';
import { minutePatch } from '../../src/engine/match';
import { coachKeys, idleMinute, minuteResult, minuteStep, type MinuteState } from '../../src/engine/coach/minute';
import { expectedHit } from '../../src/engine/typing/typing';
import { courseLessons, dictionary, keymap } from '../course/yard';

const lesson = courseLessons.find((l) => !l.friendly)!;
/** Урок с фокусом из двух клавиш и больше: на нём минута добирает клавиши, когда трудных нет. */
const focused = courseLessons.find((l) => !l.friendly && l.focus.length >= 2)!;

/** Игрок набирает минуту: по знаку раз в `gap` мс; каждый `missEvery`-й знак — промах. */
function playMinute(ms: number, gap: number, missEvery = 0): MinuteState {
  let state = minuteStep(idleMinute, { type: 'start', seed: 3, lesson, keys: 'ап', dict: dictionary, keymap, ms }).state;
  let t = 0;
  let n = 0;
  while (state.phase === 'run' && n < 5000) {
    const typing = state.typing!;
    const hit = expectedHit(keymap, typing);
    n += 1;
    const miss = missEvery > 0 && n > 1 && n % missEvery === 0;
    t += gap;
    state = minuteStep(state, miss ? { type: 'key', code: '', key: '§', t } : { type: 'key', code: hit?.key.code ?? '', key: typing.text[typing.pos] ?? '', t }).state;
  }
  return state;
}

describe('К1: минута тренера', () => {
  it('К4: клавиши — трудные по порядку; 0 и 1 трудная — добор из фокуса урока, строка минуты не пустая; чужой раскладке — пропуск', () => {
    // Ловит: `empty coach line` на первом входе (источник трудных пока пуст) и латиницу из раздела на русской раскладке.
    expect(coachKeys(['ы', 'ж', 'в'], keymap, lesson)).toBe('ыж');
    expect(coachKeys([], keymap, focused)).toHaveLength(2);
    const one = coachKeys(['ж'], keymap, focused);
    expect(one).toHaveLength(2);
    expect(one[0]).toBe('ж');
    expect(coachKeys(['q', 'ы'], keymap, focused)[0]).toBe('ы');
    const start = minuteStep(idleMinute, { type: 'start', seed: 3, lesson: focused, keys: coachKeys([], keymap, focused), dict: dictionary, keymap }).state;
    expect(start.phase === 'run' && start.typing?.text.length).toBeGreaterThan(0);
  });

  it('К1: кончается на конце строки после coach.ms (не раньше); итог — нажатия и верные', () => {
    // Ловит: минуту, оборванную посреди строки, или бесконечную; потерю счёта нажатий.
    const done = playMinute(3000, 100);
    expect(done.phase).toBe('done');
    const r = minuteResult(done);
    expect(r.correct).toBeGreaterThan(30);
    expect(r.presses).toBe(r.correct);
    expect(r.list).toHaveLength(r.presses);
  });

  it('К1: ошибки идут в нажатия и в список для формы, но не в верные', () => {
    const r = minuteResult(playMinute(3000, 100, 7));
    expect(r.presses).toBeGreaterThan(r.correct);
    expect(r.list.filter((p) => !p.ok).length).toBe(r.presses - r.correct);
  });

  it('К1: подсказка не дублируется — одна и та же подсказка на серии ошибок приходит один раз (keystep)', () => {
    // Ловит: эффект подсказки на каждое нажатие, пока подсказка та же (мигание и повторный показ).
    let state = minuteStep(idleMinute, { type: 'start', seed: 3, lesson, keys: 'ап', dict: dictionary, keymap, ms: 60000 }).state;
    const hints: string[] = [];
    for (let i = 0; i < 8; i++) {
      const r = minuteStep(state, { type: 'key', code: '', key: '§', t: 100 * (i + 1) });
      state = r.state;
      for (const e of r.effects) if (e.kind === 'hint') hints.push(e.hint);
    }
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.every((h, i) => i === 0 || h !== hints[i - 1])).toBe(true);
  });

  it('К1: до start и после конца события игнорируются; один шаг — одно состояние', () => {
    const done = playMinute(500, 100);
    expect(minuteStep(idleMinute, { type: 'key', code: 'KeyA', key: 'а', t: 1 }).state).toBe(idleMinute);
    expect(minuteStep(done, { type: 'key', code: 'KeyA', key: 'а', t: 1 }).state).toBe(done);
    expect(minuteResult(idleMinute)).toEqual({ presses: 0, correct: 0, list: [] });
  });
});

const bits = (ch: string, n: number, misses = 0) => Array.from({ length: n }, (_, i) => ({ ch, ok: i >= misses }));
const win = (ok: number, miss: number): string => '1'.repeat(ok) + '0'.repeat(miss);

describe('К2: applyKeys — запись окон (067 Т24)', () => {
  it('К2: 400 нажатий «ы» → окно 300, хвост — последние; пробел, «.», «1» не пишутся; «Ы» → «ы»', () => {
    // Ловит: рост окна без предела и мусор (пробел, знаки, цифры) в трудных клавишах.
    const c = applyKeys(emptyCoach(), [...bits('ы', 395), ...bits(' ', 20), ...bits('.', 5), { ch: '1', ok: false }, { ch: 'Ы', ok: false }, ...bits('ы', 4)]);
    expect(Object.keys(c.keys)).toEqual(['ы']);
    expect(c.keys['ы']).toHaveLength(300);
    expect(c.keys['ы']!.endsWith('0' + '1111')).toBe(true);
    expect(applyKeys(c, []).keys).toEqual(c.keys);
  });

  it('К2: ключей не больше 64 — новая буква сверх предела не пишется, старые растут', () => {
    // Ловит: раздел, который сам себя отправляет в карантин на `check`.
    const ranges: [number, number][] = [[0x61, 0x7a], [0x3b1, 0x3c9], [0x430, 0x44f]];
    const letters = ranges.flatMap(([from, to]) => Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i)));
    expect(letters.length).toBeGreaterThan(70);
    let c: CoachKeys = emptyCoach();
    for (const ch of letters) c = applyKeys(c, [{ ch, ok: true }]);
    const kept = Object.keys(c.keys);
    expect(kept).toHaveLength(64);
    expect(applyKeys(c, [{ ch: kept[0]!, ok: false }]).keys[kept[0]!]).toBe('10');
    expect(coachDef.check(c)).toEqual([]);
  });
});

describe('К3: hardKeys — худшая точность, не число ошибок (067 Т24)', () => {
  it('К3: редкая клавиша хуже частой по точности — первая; 49 нажатий и без промахов не берутся; ≤ n', () => {
    // Ловит: правило «по числу ошибок» (частая клавиша вытесняет редкую).
    const c: CoachKeys = { keys: { а: win(291, 9), ы: win(54, 6), ж: win(40, 9), в: win(60, 0) } };
    const h = hardKeys(c);
    expect(h.map((k) => k.ch)).toEqual(['ы', 'а']);
    expect(h[0]).toEqual({ ch: 'ы', permille: 900, misses: 6, presses: 60 });
    expect(h[1]).toMatchObject({ ch: 'а', permille: 970, misses: 9, presses: 300 });
    expect(hardKeys(c, 1).map((k) => k.ch)).toEqual(['ы']);
    expect(hardKeys(emptyCoach())).toEqual([]);
  });

  it('К3: равенство точности — больше промахов, затем по алфавиту', () => {
    // Ловит: порядок, который прыгает между матчами при равных процентах.
    const c: CoachKeys = { keys: { п: win(90, 10), р: win(180, 20), о: win(90, 10), в: win(180, 20) } };
    expect(hardKeys(c, 4).map((k) => k.ch)).toEqual(['в', 'р', 'о', 'п']);
  });
});

describe('К9: keyTile — % буквы, ранг пальца (067 Т24)', () => {
  it('К9: «ж»: % и «ещё N %» — окно буквы; ранг — палец rp; «ё» без пальца — finger: null, rank: 0', () => {
    // Ловит: % и «ещё N %» на плитке расходятся (одно считано по букве, другое — по пальцу не того окна).
    const form = { fingers: { rp: { w: win(80, 20), max: 1, cand: { rank: 0, n: 0 } } } };
    const c: CoachKeys = { keys: { ж: win(45, 5), ё: win(10, 0) } };
    const t = keyTile(c, form, 'Ж');
    expect(t).toEqual({ ch: 'ж', finger: 'rp', permille: 900, rank: 1, next: { rank: 2, need: 50 } });
    expect(keyTile(c, form, 'ё')).toEqual({ ch: 'ё', finger: null, permille: 1000, rank: 0, next: null });
    expect(keyTile(emptyCoach(), { fingers: { rp: { w: '', max: 4, cand: { rank: 0, n: 0 } } } }, 'э')).toMatchObject({ permille: null, rank: 4, next: null });
    expect(keyTile(emptyCoach(), emptyForm(), 'ж')).toMatchObject({ permille: null, rank: 0, next: { rank: 1, need: 900 } });
  });
});

/** Урок без фокуса: на нём добирать «из фокуса» нечем — берём свежие буквы урока (067-Р280). */
const unfocused = courseLessons.find((l) => !l.friendly && l.focus === '' && l.keys.length >= 2)!;

describe('К12: клавиши минуты — добор и подпись плитки (067 Т25, Р280, Р281)', () => {
  it('К12 Р280: трудных нет, урок без фокуса — строка минуты не пустая, из букв урока, без повторов', () => {
    // Ловит: `empty coach line` у новичка на уроке без фокуса (добор только из `focus` давал пустую строку).
    expect(unfocused.focus).toBe('');
    const keys = coachKeys([], keymap, unfocused);
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
    for (const ch of keys) expect(unfocused.keys).toContain(ch);
    const start = minuteStep(idleMinute, { type: 'start', seed: 3, lesson: unfocused, keys, dict: dictionary, keymap }).state;
    expect(start.phase === 'run' && start.typing?.text.length).toBeGreaterThan(0);
  });

  it('К12 Р280: одна трудная — она первая, вторая из добора и не повтор', () => {
    // Ловит: добор, что вытесняет единственную трудную или повторяет её.
    const [a] = Array.from(unfocused.keys);
    const keys = coachKeys([a!], keymap, unfocused);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(a);
    expect(keys[1]).not.toBe(a);
  });

  it('К12 Р280: добор — без повторов и свежие с конца урока (урок 20: «эр», урок 2: «оа»)', () => {
    // Ловит: повтор фокуса в добре («ээ» без `new Set`) и свежие буквы не с конца урока («эа»/«ао» без `.reverse()`).
    const l20 = courseLessons.find((l) => l.n === 20)!;
    expect(l20.focus).toBe('э');
    expect(coachKeys([], keymap, l20)).toBe('эр');
    const l2 = courseLessons.find((l) => l.n === 2)!;
    expect(l2.focus).toBe('');
    expect(coachKeys([], keymap, l2)).toBe('оа');
  });

  it('К12 Р280: minuteOf — две трудные из раздела: fresh=false, худшая первой, плитки в том же порядке; меньше двух — fresh=true, трудная впереди', () => {
    // Ловит: подпись «свежие клавиши» при двух настоящих трудных и «хуже всех» при добранных.
    const form = emptyForm();
    const two: CoachKeys = { keys: { а: win(260, 40), о: win(270, 30), в: win(300, 0) } };
    const got2 = minuteOf(two, form, keymap, unfocused);
    expect(got2).toMatchObject({ keys: 'ао', fresh: false });
    expect(got2.tiles.map((k) => k.ch)).toEqual(['а', 'о']);
    const one: CoachKeys = { keys: { а: win(260, 40) } };
    const got = minuteOf(one, form, keymap, unfocused);
    expect(got.fresh).toBe(true);
    expect(got.keys[0]).toBe('а');
    expect(got.keys).toHaveLength(2);
    expect(minuteOf(emptyCoach(), form, keymap, unfocused)).toMatchObject({ fresh: true });
    expect(minuteOf(emptyCoach(), form, keymap, unfocused).keys).toHaveLength(2);
    expect(minuteOf(emptyCoach(), form, keymap, null)).toEqual({ keys: '', fresh: true, tiles: [] });
  });

  it('К12 Р280: fresh считается после фильтра раскладки — трудная не с раскладки урока не делает минуту «трудной»', () => {
    // Ловит: `fresh=false` при двух трудных, из которых одна — латиница, а в строке одна трудная и добор.
    const mixed: CoachKeys = { keys: { а: win(260, 40), q: win(250, 50) } };
    const got = minuteOf(mixed, emptyForm(), keymap, unfocused);
    expect(got.keys[0]).toBe('а');
    expect(got.fresh).toBe(true);
  });

  it('К12 Т25: часы — оставшееся вверх до секунды: 59750 → «1:00», 59000 → «0:59», 0 → «0:00»', () => {
    // Ловит: «0:00» в первую же четверть секунды минуты (округление вниз с `% 60`).
    expect(clockText(59750)).toBe('1:00');
    expect(clockText(60000)).toBe('1:00');
    expect(clockText(59000)).toBe('0:59');
    expect(clockText(38000)).toBe('0:38');
    expect(clockText(1)).toBe('0:01');
    expect(clockText(0)).toBe('0:00');
    expect(clockText(-5)).toBe('0:00');
  });

  it('К12 Т25: итог минуты — патч со всеми разделами, окна букв выросли (клавиши — из идущей минуты), повтор id — null', () => {
    // Ловит: запись без `coach` (окна не растут), без `keys` у `finishMinute` (итог без плиток «было → стало»), повторную награду.
    const done = playMinute(3000, 100, 7);
    expect(done.phase).toBe('done');
    const out = endMinute(undefined, done, 'c-1');
    expect(out).not.toBeNull();
    expect(Object.keys(out!.patch).sort()).toEqual(['album', 'coach', 'form', 'school', 'stadium', 'wallet']);
    expect(out!.view.keys.map((k) => k.before.ch)).toEqual(['а', 'п']);
    expect(out!.view.coins).toBeGreaterThan(0);
    expect(out!.errors).toBeGreaterThan(0);
    const grown = out!.patch.coach as CoachKeys;
    expect(Object.keys(grown.keys)).toContain('а');
    expect(grown.keys['а']!.length).toBeGreaterThan(0);
    const sections = Object.fromEntries(Object.entries(out!.patch).map(([k, v]) => [k, { data: v }]));
    expect(endMinute(sections, done, 'c-1')).toBeNull();
    expect(endMinute(sections, done, 'c-2')).not.toBeNull();
  });

  it('К12 Т25: minutePatch — ровно шесть разделов, как отдал finishMinute (без курса и дня: минута не матч)', () => {
    const s = { wallet: 1, school: 2, form: 3, coach: 4, stadium: 5, album: 6 } as unknown as Parameters<typeof minutePatch>[0];
    expect(minutePatch(s)).toEqual(s);
  });

  it('К12 Р281: tileLine — порог взят (need 0): «держи эту точность», не «ещё 0 %»; иначе «ещё N %»; высший ранг — пусто', () => {
    // Ловит: «до «запас»: ещё 0 %» у буквы, что порог уже взяла, а ранг растёт от пальца.
    const tile = (next: KeyTile['next']): KeyTile => ({ ch: 'ы', finger: 'lr', permille: 905, rank: 0, next });
    expect(tileLine(tile({ rank: 1, need: 0 }))).toBe('до «запас»: держи эту точность');
    expect(tileLine(tile({ rank: 1, need: 7 }))).toBe('до «запас»: ещё 0,7 %');
    expect(tileLine(tile({ rank: 2, need: 40 }))).toBe('до «основа»: ещё 4 %');
    expect(tileLine(tile(null))).toBe('');
  });
});
