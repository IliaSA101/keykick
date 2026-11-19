/**
 * Очередь фоновой догрузки графики (067 Т23, журнал 19.11): экран, где ребёнок, грузит себя сам; здесь — соседи по простою,
 * с низким приоритетом, не больше `limit` разом. Окружение (загрузка, простой, слабая сеть) приходит снаружи: тест без DOM.
 * `enter` перестраивает очередь: графика текущего экрана только помечается запрошенной (экран грузит себя сам, обычным приоритетом;
 * фоновая копия запроса ему не нужна и конкурировала бы с ним за сеть), соседи — в порядке плана; не начатое от прошлого экрана
 * выбрасывается, начатое доезжает. Загруженное и запрошенное второй раз не грузится (ошибка загрузки тоже не повторяется:
 * догрузка — подготовка, экран при нужде возьмёт сам).
 */
export interface PreloadEnv {
  /** Начать фоновую загрузку (низкий приоритет); промис завершается и при успехе, и при ошибке (не отклоняется). */
  load(url: string): Promise<void>;
  /** Позвать `run`, когда браузер свободен (`requestIdleCallback`, запасной — `setTimeout`). */
  idle(run: () => void): void;
  /** Слабая сеть (`saveData`, 2g): фоновой догрузки нет совсем. */
  weak(): boolean;
}

export interface Plan {
  /** Графика текущего экрана: грузит он сам, очередь лишь не повторяет её. */
  now: readonly string[];
  /** Соседи на один переход, важные первыми. */
  near: readonly string[];
}

export const PARALLEL_LIMIT = 2;

export function createPreloader(env: PreloadEnv, limit: number = PARALLEL_LIMIT) {
  const asked = new Set<string>();
  let queue: string[] = [];
  let active = 0;
  let scheduled = false;

  function pump(): void {
    scheduled = false;
    if (env.weak()) {
      queue = [];
      return;
    }
    while (active < limit && queue.length > 0) {
      const url = queue.shift()!;
      if (asked.has(url)) continue;
      asked.add(url);
      active++;
      void env.load(url).then(() => {
        active--;
        schedule();
      });
    }
  }
  function schedule(): void {
    if (scheduled || queue.length === 0) return;
    scheduled = true;
    env.idle(pump);
  }

  return {
    enter(plan: Plan): void {
      if (env.weak()) {
        queue = [];
        return;
      }
      for (const url of plan.now) asked.add(url);
      queue = [...new Set(plan.near)].filter((u) => !asked.has(u));
      schedule();
    },
    /** Что ещё ждёт очереди, в порядке загрузки. */
    pending: (): readonly string[] => queue,
    active: (): number => active,
  };
}
