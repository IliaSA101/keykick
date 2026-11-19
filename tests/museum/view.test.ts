/** Музей клуба (067 Т11): вид полок по покупкам Двора и данным поставщика. */
import { describe, expect, it } from 'vitest';
import yard from '../../src/content/yard.json';
import { LEAGUES } from '../../src/engine/nav/leagues';
import { VIDEOS_TOTAL, museumView } from '../../src/engine/museum';

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
