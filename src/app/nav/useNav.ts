/**
 * Навигация Двора в приложении (067 К-З, 054): меню шапки, чип «Карта», Esc и колёсико Дома, Карты и Пути идут в чистую
 * `pathInput` (модель `engine/nav` + счёт входов + упор), а её эффект `go` — в роутер. Состояние модели не хранится: перед каждым
 * вводом экран берётся из текущего адреса (перезагрузка, «назад» браузера и стенд кадров не расходятся с моделью); на вкладку
 * хранятся только упор колёсика, вид входа в Путь клуба и «идёт переход» — пока роутер не сменил адрес (ленивый экран ещё
 * грузится), новый ввод не считается: двойной клик по «Путь клуба» не засчитывается за два входа.
 * Счёт входов — раздел `path` (067-Р11), растёт на входе из Дома до `fullEntries`, с Карты не растёт (054-Р11).
 */
import { shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { isScreen, type NavEffect, type NavInput, type Via } from '../../engine/nav';
import { pathInput, type Path, type Stop } from '../../engine/path';
import { useSession } from '../save/session';

/** Вид входа, с которым открыт Путь клуба: берёт экран при показе и сразу забывает (адрес, F5 и «назад» — без движения). */
const entering = shallowRef<Via | null>(null);
/** Последний упор колёсика; `bumps` растёт при каждом показанном упоре — экран по нему запускает движение плашки. */
let stop: Stop | null = null;
const bumps = shallowRef(0);
/** Идёт переход: `router.push` ещё не завершился, адрес прежний. */
let moving = false;

/** Вид входа в Путь клуба, один раз: второй вызов — `null`. */
export function takeEntering(): Via | null {
  const v = entering.value;
  entering.value = null;
  return v;
}

/** Сколько упоров колёсика показано за сеанс (счётчик для экрана Пути). */
export const bumpCount = bumps;

export function useNav() {
  const router = useRouter();
  const route = useRoute();
  const session = useSession();

  const pathOf = (): Path => {
    const p = session.player.value;
    return (p.kind === 'ok' ? (p.env.sections.path?.data as Path | undefined) : undefined) ?? { entries: {} };
  };

  /** Толкнуть роутер; пока он не вернулся, новые вводы не считаются. Не вышло (тот же адрес, отмена) — вид входа не остаётся висеть. */
  function push(to: string, via: Via | null): void {
    moving = true;
    entering.value = via; // экран Пути берёт его при показе — раньше, чем вернётся `push`
    void router
      .push(to)
      .then((failure) => {
        if (failure) entering.value = null;
      })
      .catch(() => {
        entering.value = null;
      })
      .finally(() => {
        moving = false;
      });
  }

  /**
   * Один ввод. Возвращает эффект модели (`none`, если ввод холостой или экран вне модели лиг). `now` — часы снаружи (мс).
   * Меню на экран вне модели (Кубок, Клуб — адреса-заглушки) тоже идёт через модель: она знает все пять пунктов.
   */
  function send(input: NavInput, now: number = performance.now()): NavEffect {
    const screen = String(route.name ?? '');
    if (!isScreen(screen)) {
      if (input.t === 'menu' && !moving) push(`/${input.item}`, null);
      return { kind: 'none' };
    }
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const cur = pathOf();
    const step = pathInput(cur, stop, screen, input, now, { reduced, busy: moving });
    stop = step.stop;
    if (step.effect.kind === 'bump') bumps.value += 1;
    if (step.path !== cur && session.status.value === 'ok') session.save({ path: step.path });
    if (step.effect.kind === 'go') push(`/${step.effect.to}`, step.via);
    return step.effect;
  }

  return { send };
}
