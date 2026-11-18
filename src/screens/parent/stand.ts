/**
 * Что стенд кадров (`screens/dev/FrameStand.vue`, только в разработке) сообщает странице родителя: файл, выбранный на кадре «Загрузить файл»,
 * вкладка игрока, шаг блока «Игроки» (`ask` — «Удалить игрока?», `clear` — «Очистить корзину», `back` — «Вернуть» уже нажато) и прокрутка к блоку.
 * Страница берёт это через `inject(PARENT_STAND)`; в игре поставщика нет — страница работает как всегда.
 */
import { inject } from 'vue';

export interface ParentStand {
  fileText?: string;
  tab?: string;
  step?: 'ask' | 'clear' | 'back';
  scroll?: 'players';
}

/** Ключ поставщика: стенд отдаёт функцию, чтобы страница читала актуальное значение. */
export const PARENT_STAND = 'kk-parent-stand';

/** В `setup` страницы: функция, читающая состояние стенда (вне стенда — пустое). */
export const useParentStand = (): (() => ParentStand) => inject<(() => ParentStand) | undefined>(PARENT_STAND, undefined) ?? (() => ({}));
