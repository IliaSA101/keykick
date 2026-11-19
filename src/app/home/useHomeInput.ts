/**
 * Вход правил из разделов сеанса для экранов Дома и Карты (065 Т8, 066 Т6): одно место, где из сеанса, пакета Двора
 * и часов стенда собирается `HomeInput`. Дом и Карта не считают своего — оба берут отсюда. Vue — только `computed`.
 */
import { computed, inject } from 'vue';
import type { CourseProgress } from '../../engine/course/reconcile';
import type { Day } from '../../engine/day/section';
import type { HomeInput } from '../../engine/home';
import type { Stadium } from '../../engine/home/section';
import type { Wallet } from '../../engine/rewards/section';
import { shopDef, type Shop } from '../../engine/shop/section';
import { usePack } from '../packs/usePack';
import { useSession } from '../save/session';
import { homeInputOf, type PackFacts } from './input';
import { learnDef, type Learn } from '../../engine/learn/section';
import { trainersDone } from '../../engine/school/order';
import { emptySchool, type School } from '../../engine/school/section';
import { schoolExtras } from '../school/journal';
import { providedExtras } from './provide';

/**
 * `over` — подмена полей входа стендом кадров (065-Р64); в игре её нет.
 * Возвращает всё, что экранам нужно рядом со входом: сеанс, пакет, игрока, чтение раздела, факты пакета, название урока по номеру и игровой день (часы стенда `kk-home-clock`).
 */
export function useHomeInput(over?: Partial<HomeInput>) {
  const session = useSession();
  const pack = usePack('ru.yard');
  const clock = inject<(() => { now: number; day: string }) | null>('kk-home-clock', null);
  const player = computed(() => (session.player.value.kind === 'ok' ? session.player.value : null));
  const data = <T>(name: string, empty: T): T => (player.value?.env.sections[name]?.data as T | undefined) ?? empty;
  const today = (): string => clock?.().day ?? new Date().toLocaleDateString('sv-SE');
  /** Виды с взятым тренажёром (учебная игра вида не ниже бронзы, 067-Р203): «Тур ждёт» и ожидание тренажёра их учитывают. */
  const trainers = (): string[] => trainersDone(data<Learn>(learnDef.name, learnDef.empty()).games);
  const facts = computed<PackFacts | null>(() => {
    const p = pack.pack.value;
    if (!p) return null;
    return { order: p.lessons.order, friendly: new Set(Object.entries(p.lessons.lessons).filter(([, l]) => l.friendly === true).map(([id]) => id)) };
  });
  const input = computed<HomeInput | null>(() => {
    if (!facts.value || !player.value) return null;
    const course = data<CourseProgress>('course:ru', { current: facts.value.order[0] ?? '', lessons: {}, archive: {}, leaguesDone: {} });
    const day = data<Day>('day', { played: 0, days: 0, today: null, todayN: 0, last: null });
    const wallet = data<Wallet>('wallet', { coins: 0, rest: 0, paid: [] });
    const stadium = data<Stadium>('stadium', { fans: 0, goals: 0 });
    const shop = data<Shop>(shopDef.name, shopDef.empty());
    return { ...homeInputOf({ course, day, wallet, stadium, shop }, facts.value, { ...providedExtras(), ...schoolExtras(data<School>('school', emptySchool()), day, today(), trainers()) }, today()), ...over };
  });
  const lessonName = (n: number): string => {
    const id = pack.pack.value?.lessons.order[n - 1];
    return id === undefined ? '' : (pack.pack.value?.text.ru?.lessons[id]?.name ?? '');
  };
  return { session, pack, player, data, facts, input, lessonName, today, trainers };
}
