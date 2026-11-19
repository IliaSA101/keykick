/** Музей клуба (067 Т11): вид полок по покупкам Двора и данным поставщика. */
import { describe, expect, it } from 'vitest';
import yard from '../../src/content/yard.json';
import { emptyCup } from '../../src/engine/cup';
import { cupWonOf, museumDataOf } from '../../src/app/museum/provide';
import { LEAGUES } from '../../src/engine/nav/leagues';
import { VIDEOS_TOTAL, museumView, papersShelf, videosOpen } from '../../src/engine/museum';

const ids = yard.catalog.map((c) => c.id);
const none = { videos: 0, cupWon: false };

describe('Музей: полки', () => {
  it('067 Т11 §6 пустой поставщик: ничего не куплено, «0 из 4», все кубки лиг — силуэты', () => {
    const v = museumView([], none);
    expect(v).toEqual({ bought: 0, boughtOf: ids.length, videos: 0, videosOf: VIDEOS_TOTAL, leagues: LEAGUES.map((id) => ({ id, won: false })) });
  });

  it('067 Т11 §6 покупки считаются по каталогу: чужой id и повтор не прибавляют', () => {
    expect(museumView([ids[0]!, ids[0]!, '?нет такой', ids[1]!], none).bought).toBe(2);
    expect(museumView(ids, none).bought).toBe(ids.length);
  });

  it('067 Т11 §6 Кубок двора взят — золотая только первая ячейка («Двор»), остальные лиги — силуэты', () => {
    const l = museumView([], { videos: 0, cupWon: true }).leagues;
    expect(l.map((x) => x.id)).toEqual([...LEAGUES]);
    expect(l[0]!.id).toBe('yard');
    expect(l.map((x) => x.won)).toEqual([true, false, false, false, false, false]);
  });

  it('067 Т11 §6 роликов не больше четырёх и не меньше нуля; дробное режется', () => {
    expect(museumView([], { videos: 9, cupWon: false }).videos).toBe(VIDEOS_TOTAL);
    expect(museumView([], { videos: -2, cupWon: false }).videos).toBe(0);
    expect(museumView([], { videos: 2.9, cupWon: false }).videos).toBe(2);
  });
});

describe('Музей: газеты и ролики (068 Т11)', () => {
  it('068-Т11-К3 стенд газет: восемь ячеек, вышедшие — миниатюры, метка «свежий» только на вышедшем и одном', () => {
    // Ловит: меньше восьми ячеек, «свежий» на не вышедшем выпуске и пустой стенд, у которого есть «последний» выпуск.
    const none = papersShelf([], 3);
    expect(none.cells).toHaveLength(8);
    expect(none).toMatchObject({ have: 0, of: 8, last: null });
    expect(none.cells.some((c) => c.fresh)).toBe(false);
    const s = papersShelf([1, 2, 3, 4, 5], 5);
    expect(s.cells.map((c) => c.have)).toEqual([true, true, true, true, true, false, false, false]);
    expect(s.cells.filter((c) => c.fresh).map((c) => c.n)).toEqual([5]);
    expect(s).toMatchObject({ have: 5, last: 5 });
  });

  it('068-Т11-К4 края стенда: чужой номер и повтор не считаются; свежего нет — метки нет', () => {
    // Ловит: выпуск 9 или 0 в счёте «N из 8» и двойной счёт повторного номера.
    expect(papersShelf([2, 2, 9, 0], null)).toMatchObject({ have: 1, last: 2 });
    expect(papersShelf([1, 2], null).cells.some((c) => c.fresh)).toBe(false);
  });

  it('068-Т11-К5 ролики: по одному на ступень, до трёх, четвёртый — за Кубок; в начале — ни одного', () => {
    // Ловит: «Видео · 0 из 4» на кадре урока 31 (макет — 2 из 4) и пятый ролик за кубок сверх предела.
    expect(videosOpen(1, false)).toBe(0);
    expect(videosOpen(17, false)).toBe(1);
    expect(videosOpen(31, false)).toBe(2);
    expect(videosOpen(33, false)).toBe(3);
    expect(videosOpen(33, true)).toBe(VIDEOS_TOTAL);
    expect(videosOpen(99, true)).toBe(VIDEOS_TOTAL);
  });
});

describe('Музей: данные поставщика по титулу Кубка', () => {
  it('068-Т11-К6 серебро — не победа: кубок не взят и роликов не больше трёх; золото — четвёртый ролик', () => {
    // Ловит: серебряный финал, открывающий золотой зал и ролик за кубок (038-Р10: серебро — не победа).
    const cup = (title: 'gold' | 'silver' | null) => ({ ...emptyCup(), title });
    for (const cur of [1, 17, 33, 99]) {
      const silver = museumDataOf(cup('silver'), cur);
      expect(silver.cupWon).toBe(false);
      expect(silver.videos).toBeLessThanOrEqual(3);
      expect(museumDataOf(cup(null), cur)).toEqual(silver);
      expect(museumDataOf(cup('gold'), cur).videos).toBe(silver.videos + 1);
    }
    expect(cupWonOf(cup('gold'))).toBe(true);
    expect(museumView([], museumDataOf(cup('gold'), 33)).videos).toBe(VIDEOS_TOTAL);
  });
});
