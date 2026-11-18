/** Окно сбоя поверх всего: отдельное приложение Vue в своём узле; главное приложение прячется (014-Р8). */
import { createApp, h, type App } from 'vue';
import type { Crash, CrashView } from '../../app/crash/crash';
import CrashWindow from './CrashWindow.vue';

let shown: App | null = null;

export function mountCrashWindow(crash: Crash, view: CrashView): void {
  const main = document.getElementById('app');
  if (main) main.style.display = 'none';
  if (shown) shown.unmount();
  let node = document.getElementById('crash');
  if (!node) {
    node = document.createElement('div');
    node.id = 'crash';
    document.body.append(node);
  }
  shown = createApp({
    render: () => h(CrashWindow, { step: view.step, savedAs: null, onHome: () => crash.goHome(), onSaveFile: () => crash.requestSaveFile() }),
  });
  // Ошибка самого окна не должна уронить показ второй раз: пишем в журнал.
  shown.config.errorHandler = (e) => crash.report('vue', e);
  shown.mount(node);
}
