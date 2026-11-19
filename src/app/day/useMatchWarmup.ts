/**
 * Микроразминка в матче (068-Р69, ТЗ-10.5, С4): после «На матч» и в перерыве, когда с прошлой разминки набралось ≈ 20 мин печати;
 * посреди атаки не предлагаем. Окно (`components/day/Warmup.vue`) ставит экран матча; здесь — решение «показывать ли» и запись счёта:
 * и «Готово», и «Пропустить» пишут раздел `day` один раз, повторный вызов холостой; что дальше (начать матч), решает `onClose`.
 */
import { ref, type Ref } from 'vue';
import { warmupAt, warmupAtBreak, warmupDone, warmupDoneAtBreak } from '../../engine/day/warmup';
import type { Day } from '../../engine/day/section';

export interface MatchWarmupDeps {
  day: () => Day;
  today: () => string;
  saveDay: (d: Day) => void;
  /** Время печати этого матча к перерыву, мс (первый тайм). */
  halfMs: () => number;
}

export interface MatchWarmup {
  /** Окно разминки открыто: матч стоит, клавиши экрана молчат. */
  open: Ref<boolean>;
  /** Предложить разминку перед матчем: `true` — окно открыто, начало матча ждёт закрытия. */
  offerStart: () => boolean;
  /** Предложить разминку в перерыве: `true` — окно открыто. */
  offerBreak: () => boolean;
  /** Окно закрыто («Готово», «Пропустить», Esc): счёт обнулён. Второй вызов холостой. */
  close: () => void;
}

export function useMatchWarmup(d: MatchWarmupDeps, onClose: (spot: 'start' | 'break') => void): MatchWarmup {
  const open = ref(false);
  let spot: 'start' | 'break' = 'start';
  const offer = (at: 'start' | 'break', due: boolean): boolean => {
    if (open.value) return true;
    if (!due) return false;
    spot = at;
    open.value = true;
    return true;
  };
  return {
    open,
    offerStart: () => offer('start', warmupAt(d.day(), d.today(), 'start')),
    offerBreak: () => offer('break', warmupAtBreak(d.day(), d.today(), d.halfMs())),
    close: () => {
      if (!open.value) return;
      open.value = false;
      d.saveDay(spot === 'break' ? warmupDoneAtBreak(d.day(), d.halfMs()) : warmupDone(d.day()));
      onClose(spot);
    },
  };
}
