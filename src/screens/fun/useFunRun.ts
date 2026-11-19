/**
 * Обвязка экрана игры на интерес (067-Р221; Чеканка, Мемори, дальше — Т21): фаза «старт · игра · итог», цикл requestAnimationFrame,
 * клавиши (Esc — на Базу, Enter — «Играть» и «Ещё раз» пока есть игры дня, остальное — игре), запись итога, метка «видел», снятие слушателей.
 * Правил игры здесь нет: что такое партия и ход — в `engine/base/games/*`; экран отдаёт `deal` (новая партия), `tick` (кадр часов)
 * и `press` (клавиша), а очки — в `finish`. Часы — снаружи движка: здесь `performance.now()`.
 * Esc — игра не засчитана, попытка дня цела (036-Р5). Кадр стенда (`stand`) — метку «видел» не пишет.
 * Лежит в экранах, а не в `app/`: берёт `ENTER_DELAY` из компонентов (слои: app в components не смотрит); условие Enter — `canBegin` в `app/base/play`.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { bestLine, bestOf, canBegin, dayLine, endLine, firstSeed, seenPatch, takeSeed, type FunEnd, type Phase } from '../../app/base/play';
import { failWhy, type baseOf } from '../../app/base/run';
import { useHomeInput } from '../../app/home/useHomeInput';
import { ENTER_DELAY } from '../../components/panel/focusCycle';
import type { FunId } from '../../engine/base/open';
import type { FunRecord } from '../../engine/base/section';

type Sections = Parameters<typeof baseOf>[0];
type Save = (patch: Record<string, unknown>) => { ok: boolean };
export type { Phase };

export interface FunRunOptions {
  /** Id игры на Базе (`keepy`, `memo`): по нему снимается метка «новое». */
  id: FunId;
  /** Кадр стенда: начальные фаза и итог; без стенда — старт. */
  stand: { phase: Phase; end?: FunEnd; seed?: number } | undefined;
  /** Клавиша события игры по `e.code` или `null` (служебная, не та, повтор). */
  charOf: (e: KeyboardEvent) => string | null;
  /** Новая партия: зерно и часы страницы. Вернула число — партия кончилась, не начавшись (итог сразу с этим счётом). */
  deal: (seed: number, now: number) => number | null;
  /** Кадр часов при игре; партию экран заканчивает через `finish`. */
  tick: (now: number) => void;
  /** Клавиша события при игре. */
  press: (ch: string, now: number) => void;
  /** Запись итога: рекорд и счётчик дня (обёртка над `finishGame`). */
  record: (sections: Sections, save: Save, score: number, run: string, day: string) => FunEnd;
  /** Единица счёта в строке итога («теперь он твой: 22 хода»); без неё — строка без числа (Чеканка, Мини-футбол). Нет — без единицы. */
  endUnit?: boolean;
  /** Особый текст рекорда и итога (Штрафной: голы и время) вместо общих. `why` — причина «итог не записан». */
  texts?: { best: (best: FunRecord | null) => string; end: (end: FunEnd, why: string) => string };
}

export function useFunRun(o: FunRunOptions) {
  const router = useRouter();
  const { session, today } = useHomeInput();
  /** Разделы игрока из сеанса (сеанс не `ok` — `undefined`). */
  const sections = computed<Sections>(() => (session.player.value.kind === 'ok' ? session.player.value.env.sections : undefined));
  /** Рекорд игры, строка «Сегодня: игра N из 2», текст рекорда и текст итога под счётом (067 Т21: одни и те же у всех игр на интерес). */
  const best = computed(() => bestOf(sections.value, o.id));
  const day = computed(() => dayLine(sections.value, today()));
  const bestText = computed(() => (o.texts === undefined ? bestLine(o.id, best.value) : o.texts.best(best.value)));
  const endText = computed(() => {
    if (o.texts === undefined || end.value === null) return endLine(o.id, end.value, session.status.value, o.endUnit === true);
    return o.texts.end(end.value, failWhy(session.status.value));
  });
  const phase = ref<Phase>(o.stand?.phase ?? 'start');
  const end = ref<FunEnd | null>(o.stand?.end ?? null);
  let raf = 0;
  /** Когда показан итог (мс, часы страницы): Enter сразу после последнего хода не начинает новую игру (как в окне учебной игры). */
  let endAt = 0;
  /** Зерно идущей партии; зерно следующей разыграно заранее (`nextSeed`) — экран может показать на старте то, что реально будет в игре. */
  let seed = 0;
  const nextSeed = ref(firstSeed(o.stand?.seed, Date.now()));
  const clock = (): number => globalThis.performance.now();

  function loop(): void {
    globalThis.cancelAnimationFrame(raf);
    raf = globalThis.requestAnimationFrame(() => {
      if (phase.value !== 'play') return;
      o.tick(clock());
      if (phase.value === 'play') loop();
    });
  }
  /** Итог партии: `score` — счёт; запись — только при сеансе `ok`, иначе итог показан без записи. */
  function finish(score: number): void {
    globalThis.cancelAnimationFrame(raf);
    const save: Save = (patch) => (session.status.value === 'ok' ? session.save(patch) : { ok: false });
    end.value = o.record(sections.value, save, score, `${o.id}-${seed}`, today());
    endAt = clock();
    phase.value = 'end';
  }
  function begin(): void {
    const taken = takeSeed(nextSeed.value, Date.now());
    seed = taken.seed;
    nextSeed.value = taken.next;
    end.value = null;
    phase.value = 'play';
    const over = o.deal(seed, clock());
    if (over !== null) finish(over);
    else loop();
  }
  const toBase = (): void => void router.push('/base');
  function onKey(e: KeyboardEvent): void {
    if (e.defaultPrevented) return;
    if (e.key === 'Escape') toBase();
    else if (phase.value === 'play') {
      const ch = o.charOf(e);
      if (ch === null) return;
      e.preventDefault();
      o.press(ch, clock());
    } else if (e.key === 'Enter' && canBegin({ phase: phase.value, left: end.value?.left ?? 0, repeat: e.repeat, onButton: e.target instanceof HTMLButtonElement, openedAt: endAt, now: e.timeStamp, delay: ENTER_DELAY })) begin();
  }
  onMounted(() => {
    globalThis.addEventListener('keydown', onKey);
    if (o.stand !== undefined) return; // кадр стенда: метку не пишем
    const patch = seenPatch(sections.value, o.id);
    if (patch !== null && session.status.value === 'ok') session.save(patch);
  });
  onUnmounted(() => {
    globalThis.removeEventListener('keydown', onKey);
    globalThis.cancelAnimationFrame(raf);
  });

  return { session, today, sections, phase, end, best, day, bestText, endText, clock, begin, finish, toBase, nextSeed };
}
