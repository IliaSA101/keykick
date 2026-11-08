/**
 * Кнопка «Сломать» (спека 014-Т6, только dev-сборка): на странице родителя бросает ошибку из таймера окна —
 * перехватчик (014-Т5) показывает экран сбоя. Подключается из `dev/routes.ts`; в выкладку не попадает
 * (проверка — слова нет в `dist`). Текст — из `i18n/ru/dev.ts`, который в `ru.ts` не входит.
 * Вид сбоя — по адресу: `#/parent` — ошибка из таймера окна, `#/parent?crash=promise` — отклонённое обещание.
 */
import { dev } from '../i18n/ru/dev';

let button: HTMLButtonElement | null = null;

/** Нужен сбой-обещание: в адресе `crash=promise`. Читается при нажатии, а не при показе кнопки. */
function wantsPromise(): boolean {
  const query = globalThis.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(query).get('crash') === 'promise';
}

function sync(): void {
  const onParent = globalThis.location.hash.startsWith('#/parent');
  if (onParent && button === null) {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'dev-break';
    b.textContent = dev.breakButton;
    b.title = dev.breakTitle;
    b.setAttribute(
      'style',
      'position:fixed;right:12px;bottom:12px;z-index:9999;min-height:44px;padding:0 16px;border:2px solid #b00020;border-radius:8px;background:#fff;color:#b00020;font:700 16px system-ui,sans-serif;cursor:pointer',
    );
    b.addEventListener('click', () => {
      if (wantsPromise()) {
        void Promise.reject(new Error('dev crash: promise'));
        return;
      }
      globalThis.setTimeout(() => {
        throw new Error('dev crash: button');
      });
    });
    document.body.append(b);
    button = b;
  } else if (!onParent && button !== null) {
    button.remove();
    button = null;
  }
}

export function mountBreakButton(): void {
  globalThis.addEventListener('hashchange', sync);
  sync();
}
