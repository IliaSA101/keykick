/**
 * План перезагрузки страницы после загрузки файла (спека 014-Р13, 018-Р26): через `delayMs` родитель успел прочитать итог,
 * затем ждём слияние журнала (не дольше `journalMaxMs`) и перезагружаем. Уход со страницы в любой момент до самой
 * перезагрузки — сразу: ключ итога снят, `reload` вызван, журнал не ждём (старая память главной иначе затрёт загруженное;
 * оборванное слияние журнала повторит повторная загрузка файла). `reload` вызывается ровно один раз. Чисто: часы и
 * окно приходят снаружи.
 */
export interface ReloadPlanDeps {
  setTimer(cb: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  reload(): void;
  /** Снять ключ итога прошлой загрузки (его показывать уже некому). */
  clearReport(): void;
  /** Пауза перед перезагрузкой. */
  delayMs: number;
  /** Сколько ждать журнал после паузы. */
  journalMaxMs: number;
}

export function createReloadPlan(d: ReloadPlanDeps) {
  /** `idle` — не назначена; `timer` — ждём паузу; `journal` — пауза прошла, ждём журнал; `done` — `reload` вызван. */
  let state: 'idle' | 'timer' | 'journal' | 'done' = 'idle';
  const handles: unknown[] = [];

  function finish(): void {
    if (state === 'done') return;
    state = 'done';
    for (const h of handles.splice(0)) d.clearTimer(h);
    d.reload();
  }

  return {
    /** Назначить перезагрузку; `journal` — слияние журнала из файла (отказ не мешает). Повторный вызов игнорируется. */
    schedule(journal?: Promise<unknown>): void {
      if (state !== 'idle') return;
      state = 'timer';
      journal?.catch(() => undefined); // отказ до паузы — не «необработанный»; сам исход ждёт `finish`
      handles.push(
        d.setTimer(() => {
          state = 'journal';
          if (journal === undefined) return finish();
          handles.push(d.setTimer(finish, d.journalMaxMs));
          journal.then(finish, finish);
        }, d.delayMs),
      );
    },
    /** Ушли со страницы: если перезагрузка назначена и ещё не выполнена — сразу, ключ итога снят. */
    leave(): void {
      if (state === 'idle' || state === 'done') return;
      d.clearReport();
      finish();
    },
    /** Перезагрузка назначена и ещё не выполнена. */
    pending: (): boolean => state === 'timer' || state === 'journal',
  };
}
