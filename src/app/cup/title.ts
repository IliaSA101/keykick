/**
 * Титул Кубка двора после победы в финале (068 Т9, ТЗ-8.7, 9.7, кадры Э5.39/.40): ролик по запросу → окно титула → Дом с праздником.
 * Чистые функции от фактов свистка (`finishCup`): окно называет только то, что выдано сейчас (факты `kit`, `patch`, `boots`, `stage`, `pack`).
 * Серебро и повтор после золота титула не дают (К3, К4): фактов `title` у них нет. Показ — `components/cup/CupTitle.vue`.
 */
import type { Team } from '../../engine/cup';
import { fill } from '../home/texts';
import { ru } from '../../i18n/ru';
import type { CupFinished } from './run';

const t = ru.cup.champion;

/** Одна награда ленты: кубок, нашивка, форма (`kitId` из `prizes.json`), бутсы, ступень «Открытие», пак. */
export interface TitleTile {
  kind: 'cup' | 'patch' | 'kit' | 'boots' | 'step' | 'pack';
  label: string;
  kitId: string | null;
}

export interface CupTitle {
  head: string;
  sub: string;
  tiles: TitleTile[];
  museum: string;
  next: string;
}

/** Подпись формы-награды по id: титульные формы называются в ленте своими словами (кадр Э5.39), а не именем из `prizes.json`. */
const KIT_LABEL: Readonly<Record<string, string>> = { 'p-ystars': t.stars, 'p-champ': t.champ };

/** Окно титула по свистку; титула нет (проигрыш, серебро, повтор, матч группы) — `null`. `team` — соперник финала. */
export function cupTitle(fin: Pick<CupFinished, 'view' | 'facts'>, team: Team | undefined): CupTitle | null {
  if (!fin.facts.some((f) => f.fact === 'title')) return null;
  const v = fin.view;
  // порядок ленты — как в кадре Э5.39: кубок, нашивка, формы, бутсы, ступень, пак
  const has = (fact: 'patch' | 'boots' | 'stage'): boolean => fin.facts.some((f) => f.fact === fact);
  const tiles: TitleTile[] = [{ kind: 'cup', label: ru.home.cup.name, kitId: null }];
  if (has('patch')) tiles.push({ kind: 'patch', label: t.patch, kitId: null });
  for (const f of fin.facts) if (f.fact === 'kit' && KIT_LABEL[f.id] !== undefined) tiles.push({ kind: 'kit', label: KIT_LABEL[f.id]!, kitId: f.id });
  if (has('boots')) tiles.push({ kind: 'boots', label: t.boots, kitId: null });
  if (has('stage')) tiles.push({ kind: 'step', label: t.step, kitId: null });
  if (v.pack) tiles.push({ kind: 'pack', label: ru.cup.awards.pack, kitId: null });
  const rival = team === undefined ? '' : (ru.cup.instr[team.id] ?? team.name);
  return { head: t.head, sub: fill(t.sub, { a: v.total.me, b: v.total.opp, name: rival }), tiles, museum: t.museum, next: t.next };
}

/** С чего начинается титул: ролик (по запросу, грузится только сейчас) или сразу окно — «меньше движения» и кадр стенда ролика не включают (ТЗ-9.7). */
export type TitleStep = 'video' | 'window';
export const titleStart = (o: { reduced: boolean; frame: boolean }): TitleStep => (o.reduced || o.frame ? 'window' : 'video');

/** Что после шага: ролик → окно; окно → `null` (идти дальше из экрана: Дом, праздник — `titleFestive`). */
export const titleNext = (step: TitleStep): TitleStep | null => (step === 'video' ? 'window' : null);

/** Праздник Дома и Карты (Э2.05, Э2.104): в игровой день титула; назавтра — обычный Дом. Раздел `cup` не меняется (формат сохранения прежний). */
export const titleFestive = (cup: { title: 'gold' | 'silver' | null; titleDay: string | null }, today: string): boolean => cup.title === 'gold' && cup.titleDay === today;
