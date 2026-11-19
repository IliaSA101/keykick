/**
 * Окна наград после итога матча Кубка (068 Т6-3, ТЗ-8.7, кадры Э5.37, .38, .41): чистая функция от фактов свистка (`finishCup`).
 * Форма за выход из группы и за полуфинал — окно после карточки итога; серебро первого проигранного финала — окно вместо карточки,
 * без праздника (запрет К4). Титул (Э5.39/.40) — задача Т9: его формы окон здесь не получают. Повтор после титула окон не даёт (ТЗ-8.13).
 * Показ — `components/cup/CupAward.vue`; куда ведут кнопки, решает экран итога.
 */
import { PRIZE_GROUP, PRIZE_SEMI, type Team } from '../../engine/cup';
import { prizeOf } from '../../engine/album/kit';
import { ru } from '../../i18n/ru';
import { fill } from '../home/texts';
import type { CupFinished } from './run';

const t = ru.cup.awards;

/** Заголовок окна формы по её id: окна только у форм группы и полуфинала. */
const KIT_TITLES: Readonly<Record<string, string>> = { [PRIZE_GROUP]: t.groupTitle, [PRIZE_SEMI]: t.semiTitle };

export interface CupAward {
  kind: 'kit' | 'silver';
  title: string;
  lead: string;
  /** Строка под картинкой: у серебра — кто победил; у формы — пусто. */
  sub: string;
  /** Призовая форма в окне (`prizes.json`); у серебра — `null` (медаль). */
  kitId: string | null;
  /** Метки: «новая форма — в Раздевалке», «+ пак»; у серебра — про Музей. */
  tags: string[];
  /** Главная кнопка: форма — «Дальше» (как в карточке), серебро — «Сыграть финал снова». */
  primary: string;
  /** Что делает главная кнопка: `card` — то же, что у карточки итога, `replay` — снова матч. */
  primaryGo: 'card' | 'replay';
  /** Тихая кнопка: форма — «В Раздевалку», серебро — «Потом» (Дом). */
  quiet: string;
  quietGo: 'locker' | 'home';
}

/** Окна наград итога по порядку показа: серебро (одно, вместо карточки) или формы по фактам; `team` — соперник раунда. */
export function cupAwards(fin: Pick<CupFinished, 'view' | 'facts'>, team: Team | undefined): CupAward[] {
  const v = fin.view;
  if (v.replay) return [];
  if (fin.facts.some((f) => f.fact === 'silver')) {
    const c = ru.cup.card;
    const sub = team === undefined ? '' : v.series !== null ? fill(t.silverSeries, { name: team.name, street: team.street }) : fill(t.silverRival, { name: team.name, street: team.street, a: v.total.opp, b: v.total.me });
    return [{ kind: 'silver', title: c.silver, lead: c.silverSub, sub, kitId: null, tags: [t.silverMuseum], primary: ru.cup.screen.playFinalAgain, primaryGo: 'replay', quiet: ru.cup.result.later, quietGo: 'home' }];
  }
  const out: CupAward[] = [];
  for (const f of fin.facts) {
    const name = f.fact === 'kit' && KIT_TITLES[f.id] !== undefined ? prizeOf(f.id)?.name : undefined;
    if (f.fact !== 'kit' || name === undefined) continue;
    const tags = [ru.cup.screen.lockerTag, ...(v.pack ? [t.pack] : [])];
    out.push({ kind: 'kit', title: KIT_TITLES[f.id]!, lead: fill(t.kitLead, { name }), sub: '', kitId: f.id, tags, primary: ru.result.next, primaryGo: 'card', quiet: t.locker, quietGo: 'locker' });
  }
  return out;
}
