/**
 * Бег доли `t` отъезда от Дома к Пути клуба (М8, 067 Т10): часы — `performance.now` и кадры браузера, форма движения — чистая
 * `engine/path/enter`. Вид входа берётся один раз при показе экрана (`takeEntering`); адрес, F5 и «назад» — вида нет, движения нет.
 * Стенд кадров задаёт `t` числом: кадр стоит, ничего не бежит.
 */
import { onMounted, onUnmounted, ref } from 'vue';
import { enterPlan } from '../../engine/path';
import type { Via } from '../../engine/nav';

export interface EnterStand {
  via?: Via;
  t?: number;
}

export function useEnterRun(via: Via | null, stand: EnterStand | null) {
  const fixed = stand?.t;
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const plan = enterPlan(fixed === undefined ? via : (stand?.via ?? 'full'), fixed === undefined ? reduced : false);
  const t = ref(plan === null ? 1 : (fixed ?? 0));
  let raf = 0;
  onMounted(() => {
    if (plan === null || fixed !== undefined) return;
    const start = performance.now();
    const tick = (now: number): void => {
      t.value = Math.max(0, Math.min(1, (now - start) / plan.ms));
      if (t.value < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  onUnmounted(() => cancelAnimationFrame(raf));
  return { plan, t };
}
