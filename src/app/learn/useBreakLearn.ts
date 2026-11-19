/**
 * Учебная игра в перерыве матча для экрана (067 Т17, этап 6; временный вход — заменит `LearnCard` Т18): окно, вход, закрытие, «Ещё игра».
 * Логика выбора — `entry.ts` (чистая); здесь только состояние Vue и проводка сеанса. Запись итога — `commitLearn` внутри окна, через `deps`.
 * Ответ `session.save` не теряется: отказ записи ложится в `fail` (статус сеанса), экран говорит причину.
 */
import { computed, ref, shallowRef, watch, type Ref } from 'vue';
import { breakPlan, NO_RIGHTS, rightsStep, type AfterGame, type BreakPlan, type RightsEvent, type RightsFlow } from '../break/cards';
import { rightsCard, type RightsCard } from '../../engine/learn/steps';
import { learnDef, type Learn } from '../../engine/learn/section';
import type { JournalEntry } from '../../engine/journal';
import { matchJournal } from '../journal/app';
import type { Status, useSession } from '../save/session';
import { breakCtx, breakJournal, commitDeps, enterBreak, type BreakEntry, type EntryFacts } from './entry';
import type { EndModel } from './view';

type Session = ReturnType<typeof useSession>;

export interface BreakLearnFacts {
  /** Урок матча и его выученные буквы; `null` — урок ещё не выбран. */
  lesson: () => { n: number; keys: string } | null;
  now: () => number;
  day: () => string;
  /** Урок для показа карточек перерыва (в кадре стенда он есть, хотя играть в нём нельзя); нет — как `lesson`. */
  peek?: () => { n: number; keys: string } | null;
  /** Стенд (кадры Э4.17, 20): «после игры» и «Права» уже на экране, как если бы игру только что сыграли; в игре не задают. */
  stage?: () => { after?: AfterGame | undefined; rights?: { fresh: string } | undefined } | null;
}

export function useBreakLearn(session: Session, facts: BreakLearnFacts) {
  const entry = shallowRef<BreakEntry | null>(null);
  /** Журнал матчей — источник ставки; читается при каждом открытии (запись свистка уже легла). */
  const entries = ref<JournalEntry[]>([]);
  /** Причина, по которой запись итога не легла (`Status` сеанса); `null` — всё записано. */
  const fail: Ref<Status | null> = ref(null);
  let opening = false;

  const sections = (): Record<string, { data: unknown } | undefined> | undefined => (session.player.value.kind === 'ok' ? session.player.value.env.sections : undefined);
  const ok = (): boolean => session.player.value.kind === 'ok' && session.status.value === 'ok';
  const factsNow = (): EntryFacts | null => {
    const l = facts.lesson();
    return l === null ? null : { lesson: l.n, keys: l.keys, entries: entries.value, now: facts.now(), day: facts.day() };
  };

  /** Карточки перерыва (Э4.15–19): очередь ТЗ-7.3, 7.4 по разделам игрока; сеанс не `ok` — карточек нет. */
  const plan = computed<BreakPlan>(() => {
    const l = (facts.peek ?? facts.lesson)();
    if (l === null) return { cards: [], lead: null };
    const f: EntryFacts = { lesson: l.n, keys: l.keys, entries: entries.value, now: facts.now(), day: facts.day() };
    const learn = (sections()?.[learnDef.name]?.data as Learn | undefined) ?? learnDef.empty();
    return breakPlan(learn, breakCtx(sections(), f), ok());
  });
  /** Итог только что сыгранной игры (карточка «после игры») и карточка «Права» (ТЗ-7.6), пока не закрыта. */
  const after = ref<AfterGame | null>(null);
  const flow = ref<RightsFlow>(NO_RIGHTS);
  const rights = computed(() => flow.value.rights);
  const step = (e: RightsEvent): boolean => {
    const r = rightsStep(flow.value, e);
    flow.value = r.state;
    return r.go;
  };
  const done = (game: string, r: { end: EndModel; rights: RightsCard | null }): void => {
    after.value = { id: game, end: r.end };
    step({ do: 'played', game, rights: r.rights });
  };
  /** Закрыть «Права»; `true` — перед ними был «Второй тайм», матч продолжает вызывающий. */
  const dismissRights = (): boolean => step({ do: 'closeRights' });
  /** «Второй тайм» из окна игры: `true` — прав нет, матч идёт сразу; иначе «Права» — поверх перерыва, матч — после них. */
  const secondNow = (): boolean => step({ do: 'second' });
  /** Кадр стенда: итог и «Права» кладутся, когда сеанс уже отдал раздел `learn` (карточка «Прав» считается по нему). */
  watch(ok, (good) => {
    const st = good ? (facts.stage?.() ?? null) : null;
    if (st === null) return;
    if (st.after) after.value = st.after;
    if (st.rights) {
      const card = rightsCard((sections()?.[learnDef.name]?.data as Learn | undefined) ?? learnDef.empty(), true, 'break');
      flow.value = { ...flow.value, rights: card === null ? null : { card, fresh: st.rights.fresh } };
    }
  }, { immediate: true });
  /** Журнал нужен ставке карточек уже на входе в перерыв, не только по открытию игры. */
  watch(() => (facts.peek ?? facts.lesson)()?.n, (n) => n !== undefined && void matchJournal().all().then((all) => void (entries.value = breakJournal(all, session.player.value))), { immediate: true });

  /** Открыть игру (первую очереди или `game`); `again` — та же игра ещё раз. Двойной щелчок и вход без `ok` — холостые. */
  async function open(game?: string, again = false): Promise<void> {
    if (opening || (entry.value !== null && game === undefined)) return;
    opening = true;
    try {
      entries.value = breakJournal(await matchJournal().all(), session.player.value); // журнал один на устройство: ставка — по матчам этого игрока
      const f = factsNow();
      if (f === null) return;
      fail.value = null;
      entry.value = enterBreak(sections(), ok(), f, facts.now() % 2147483647, game, again);
    } finally {
      opening = false;
    }
  }

  const close = (): void => void (entry.value = null);

  const deps = commitDeps(sections, (patch) => session.save(patch), (s) => void (fail.value = s));

  /** «Ещё раз» из итога: та же игра, но «до игры» и ставка — по свежим разделам. */
  const again = (): Promise<void> => (entry.value === null ? Promise.resolve() : open(entry.value.flow.game, true));

  return { entry, plan, after, rights, done, dismissRights, secondNow, fail, open, again, close, deps };
}
