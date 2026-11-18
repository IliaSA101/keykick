/**
 * Перехват ставится при оценке этого модуля. Он — ПЕРВЫЙ импорт `src/main.ts`: бросок при оценке App.vue или роутера
 * попадает уже в слушатель, а не в белый экран (К6, ТЗ-12.14). Ничего, что читает хранилище, здесь не импортируется.
 */
import { createCrash, type CrashTarget } from './crash';
import { goHomeNow } from './home';

export const crash = createCrash({
  now: () => Date.now(),
  origin: window.location.origin,
  goHome: () => goHomeNow(window), // не `location.hash = …`: роутер откатит переход при сбое (home.ts)
});

// Окно подходит по смыслу (`error`, `unhandledrejection`); типы событий DOM уже, чем «любое событие» фабрики, поэтому приведение.
crash.listen(window as unknown as CrashTarget);
