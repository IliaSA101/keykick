/**
 * «На главную» из окна сбоя: адрес Дома ставится БЕЗ события навигации, затем перезагрузка (063 Т4, К6).
 * Присваивание `location.hash` будит роутер (popstate); охрана входа при сбое отвечает «отмена» (`guardRoute` → false),
 * и vue-router откатывает переход назад (`history.go(-1)`) — адрес снова `#/dev/kit…`, а отложенная перезагрузка
 * пропадает: кнопка «нажимается», но ничего не происходит. `replaceState` роутер не будит.
 */
export interface HomeEnv {
  history: { replaceState(state: unknown, unused: string, url: string): void };
  location: { reload(): void };
}

export function goHomeNow(win: HomeEnv): void {
  win.history.replaceState(null, '', '#/home');
  win.location.reload();
}
