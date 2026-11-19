/**
 * Перерыв матча с учебной игрой (067 Т17–Т18): состояние окна игры, «Права на компьютер» и «Второй тайм» — вынесено из экрана матча.
 * Вход — только в перерыве, не в кадре стенда и не без записи (сеанс не `ok`); карточки (`peek`) в кадре стенда видны.
 */
import { computed, type ComputedRef, type Ref } from 'vue';
import type { useSession } from '../save/session';
import { useBreakLearn } from '../learn/useBreakLearn';
import type { Club } from '../../engine/club/section';
import { ru } from '../../i18n/ru';
import type { FrameMatch } from './frame';

export interface MatchBreakFacts {
  frame: FrameMatch | undefined;
  phase: ComputedRef<string>;
  lessonNo: Ref<number>;
  lessonKeys: Ref<string>;
  club: ComputedRef<Club>;
  now: () => number;
  day: () => string;
  /** Матч идёт дальше (событие `half2`). */
  secondHalf: () => void;
}

export function useMatchBreak(session: ReturnType<typeof useSession>, f: MatchBreakFacts) {
  const here = (): { n: number; keys: string } => ({ n: f.lessonNo.value, keys: f.lessonKeys.value });
  const learn = useBreakLearn(session, {
    lesson: () => (f.frame || f.phase.value !== 'break' ? null : here()),
    now: f.now,
    day: f.day,
    peek: () => (f.phase.value === 'break' ? here() : null),
    stage: () => f.frame ?? null,
  });
  /** Окно учебной игры открыто (на стенде — по полю кадра): за ним ни клавиатуры, ни «Паузы» — в окне Esc значит «назад» (Э8.13–27). */
  const learnOpen = computed(() => learn.entry.value !== null || f.frame?.learn === true);
  /** «Второй тайм» из окна игры: окно закрывается, матч идёт дальше (повторный Enter — холостой: окна уже нет). */
  function learnSecond(): void {
    if (learn.entry.value === null) return;
    learn.close();
    if (learn.secondNow()) f.secondHalf(); // «Права» (ТЗ-7.6) — перед вторым таймом, не посреди него
  }
  /** «Права на компьютер» закрыты (Enter, «Дальше», 10 с): если до них нажали «Второй тайм» — матч идёт дальше. */
  function rightsClosed(): void {
    if (learn.dismissRights()) f.secondHalf();
  }
  /** Строка удостоверения «Прав»: «Саша · клуб «Прогресс»». */
  const ownerLine = computed(() => {
    const back = f.club.value.backName; // имя ребёнка — как на спине формы, но не заглавными
    return ru.learn.brk.rights.owner.replace('{name}', back.charAt(0) + back.slice(1).toLowerCase()).replace('{club}', f.club.value.name);
  });
  return { learn, learnOpen, learnSecond, rightsClosed, ownerLine };
}
