/**
 * День на экране итога матча (068 Т8): строка тренера над итогом, «Итог дня» (выпуск или полоса) и микроразминка после «пальцы устали».
 * Решение «что показать» принято на свистке (`afterMatch`, `app/match/finish`) — здесь только показ: журнал дня сеанса, тексты, окна.
 * Выпуск в итоге дня помечается показанным при открытии (С2), как на входе в Дом.
 */
import { computed, ref, shallowRef, type ComputedRef, type Ref } from 'vue';
import { coachNameOf } from '../../engine/club/start';
import type { Club } from '../../engine/club/section';
import type { AfterMatch } from '../../engine/day/flow';
import { factsOfLog, noteMatch, type DayLog } from '../../engine/day/log';
import type { Day } from '../../engine/day/section';
import type { School } from '../../engine/school/section';
import { daySummary } from '../../engine/day/summary';
import { warmupDone } from '../../engine/day/warmup';
import type { ResultView } from '../../engine/match';
import { markPaperShown, type Story } from '../../engine/story';
import { ru } from '../../i18n/ru';
import { coachText, stripView, type StripView } from './view';

/** Журнал дня на время сеанса по игроку (после перезагрузки пуст — полоса скромнее): игрок Б не видит звёзд и «Пройден» игрока А. */
const sessionLogs = new Map<string, DayLog>();

/** Что экрану итога нужно от решения свистка (`AfterMatch`): строка, итог дня и числа «пальцы устали»; кадр стенда несёт только это (068 Т8в). */
export type Rhythm = Pick<AfterMatch, 'line' | 'summary' | 'tired' | 'returned'>;

export interface ResultDayDeps {
  /** Игрок (`player.pid`): журнал дня — свой у каждого. */
  pid: string;
  rhythm: Rhythm | undefined;
  view: ResultView | null;
  /** Номер урока матча. */
  no: number;
  today: () => string;
  /** Следующий урок Двора (`null` — пройден) и звёзд всего. */
  next: () => number | null;
  allStars: () => number;
  day: () => Day;
  story: () => Story;
  club: () => Club;
  lessonName: (n: number) => string;
  /** Новые буквы урока матча (`meta.letters`): событие «В составе новенькие» — только при первом прохождении. */
  letters?: string;
  /** Раздел «Школа»: из него — событие «Медаль тура» (тур сдаётся не здесь); нет — события нет. */
  school?: () => School;
  /** Матч Кубка (068-Р73): счёт и соперник для журнала дня; нет — матч урока. */
  cup?: { a: number; b: number; street: string };
  saveStory: (s: Story) => void;
  /** Разминка сделана или пропущена: раздел `day` с обнулённым счётом печати (story.md §4а). */
  saveDay: (d: Day) => void;
}

export interface ResultDay {
  /** Строка тренера над итогом: текст и имя, или `null`. */
  coach: ComputedRef<{ text: string; name: string } | null>;
  /** Итог дня открыт: полоса или выпуск (номер). */
  strip: Ref<StripView | null>;
  paper: Ref<number | null>;
  warm: Ref<boolean>;
  /** Строка — «пальцы устали» (первая кнопка — разминка). */
  tired: ComputedRef<boolean>;
  /** Первая кнопка карточки: разминка («устали»), «Итог дня» (строка тренера или этот матч довёл день до итога) или обычная цепочка (`null`). */
  act: ComputedRef<'warmup' | 'summary' | null>;
  openSummary: () => void;
  openWarm: () => void;
  closeWarm: () => void;
}

export function useResultDay(d: ResultDayDeps): ResultDay {
  const returned = d.rhythm?.returned === true;
  if (d.rhythm !== undefined && d.view === null && d.cup !== undefined) sessionLogs.set(d.pid, noteMatch(sessionLogs.get(d.pid) ?? null, d.today(), { newStars: 0, recordCpm: null, passedLesson: null, cup: d.cup, returned }));
  if (d.rhythm !== undefined && d.view !== null) {
    const v = d.view;
    // «пройден» — только впервые: все звёзды урока получены сейчас (`newStars === starsAll`)
    sessionLogs.set(d.pid, noteMatch(sessionLogs.get(d.pid) ?? null, d.today(), { newStars: v.newStars, recordCpm: v.record.kind === 'beaten' ? v.cpm : null, passedLesson: v.passed && v.newStars === v.starsAll ? d.no : null, returned, letters: d.letters ?? '' }));
  }
  const log = (): DayLog | null => sessionLogs.get(d.pid) ?? null;
  const line = d.rhythm?.line ?? null;
  const warmed = ref(false);
  const warm = ref(false);
  const summary = ref(false);
  const paper = ref<number | null>(null);
  const name = coachNameOf(d.club().coach);

  const coach = computed(() => {
    if (warmed.value) return { text: ru.day.coach.warmed, name };
    if (line === null) return null;
    // числа «устали» посчитаны на свистке; нет записи (saved: false) — «0 %» не показываем, строку берём без чисел
    const norm = d.rhythm?.tired ?? null;
    return { text: coachText(line, { days: d.day().days, next: d.next(), ...(norm === null ? {} : norm) }), name };
  });
  /** Итог дня решается один раз, при открытии: выпуск помечается показанным и сохранение меняет `story` — пересчёт дал бы полосу вместо выпуска. */
  const strip = shallowRef<StripView | null>(null);
  function openSummary(): void {
    if (summary.value) return;
    summary.value = true;
    const s = daySummary(d.story(), factsOfLog(log(), d.today(), d.next(), d.allStars(), d.school?.() ?? null));
    if (s.kind === 'paper') {
      d.saveStory(markPaperShown(d.story(), s.n));
      paper.value = s.n;
    } else strip.value = stripView(s, { club: d.club().name, day: d.day().days, lessonName: d.lessonName });
  }
  const tired = computed(() => line === 'tired' && !warmed.value);
  return {
    coach,
    strip,
    paper,
    warm,
    tired,
    act: computed(() => (tired.value ? 'warmup' : line !== null || d.rhythm?.summary === true ? 'summary' : null)),
    openSummary,
    openWarm: () => void (warm.value = true),
    closeWarm: () => {
      if (warm.value) d.saveDay(warmupDone(d.day())); // и «Готово», и «Пропустить» обнуляют счёт печати с разминки
      warm.value = false;
      warmed.value = true;
    },
  };
}
