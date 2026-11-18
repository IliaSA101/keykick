/** Роутер — единственный в `app`, кто знает экраны (063-Р1). Хэш-адреса: F5 не даёт 404 на GitHub Pages. */
import { createRouter, createWebHashHistory } from 'vue-router';
import { isParentRoute } from '../../engine/players/entry';
import { crash } from '../crash/boot';
import { phoneNow, watchPhone } from '../phone/device';
import { useSession } from '../save/session';
import { guardRoute } from './guard';
import { routes } from './routes';

export const router = createRouter({ history: createWebHashHistory(), routes });

/** Сбой загрузки экрана — в перехват (тихую перезагрузку после выпуска добавит Т11 вместе с хранилищем метки). */
router.onError((e) => crash.report('vue', e));

/**
 * Сеанс открывается, когда вкладке нужна игра: на телефоне без клавиатуры `main.ts` его не открывал (экран «Открой на
 * компьютере» ничего не читает и не пишет). `init` — один раз за вкладку, повторный вызов отдаёт тот же ответ (063 Т12б).
 */
const openSession = (fullPath: string): Promise<void> => useSession().init({ look: isParentRoute(`#${fullPath}`) });

/** Охрана входа (К9): телефон — «Открой на компьютере» до всего; первый запуск, «Кто играет?», родитель — по состоянию сохранения. */
router.beforeEach(async (to) => {
  if (!phoneNow()) await openSession(to.fullPath);
  return guardRoute(to, useSession(), () => crash.crashed(), phoneNow);
});

/** Устройство сменилось (поворот планшета, подключили клавиатуру с мышью): охрана решает заново для текущего адреса. */
watchPhone(() => {
  const here = router.currentRoute.value;
  void (async () => {
    if (!phoneNow()) await openSession(here.fullPath);
    const to = await guardRoute(here, useSession(), () => crash.crashed(), phoneNow);
    if (typeof to === 'string') await router.replace(to);
  })().catch((e: unknown) => crash.report('vue', e));
});
