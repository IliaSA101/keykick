/**
 * Вход на Дом (068 Т7, ТЗ-10.11): за вход — не больше одного сюжетного окна (комикс раньше выпуска, 068-Р7, Р41). Выпуски вех выходят с числами клуба на этот день
 * (068-Р30), флаг «показан» ставится при открытии — перезагрузка с открытым окном его не повторяет (С2). Вторая вкладка (сеанс не `ok`) только смотрит:
 * ничего не выпускаем и не помечаем. Стенд кадров (`off`) — свои окна из фикстуры. Условия и вход — `entryCtxOf`, расчёт — `enterHome` (чистые функции);
 * чтение разделов — `useHomeInput`.
 */
import { ref, watch, type Ref } from 'vue';
import type { HomeInput } from '../../engine/home';
import type { EntryWindow } from '../../engine/story';
import { enterHome } from './entry';
import { entryCtxOf } from './entryCtx';
import { paperSectionsOf } from './paperIn';
import type { useHomeInput } from '../home/useHomeInput';

type Home = ReturnType<typeof useHomeInput>;

/** Окно, открытое на этом входе (комикс или выпуск), или `null`. Решение берётся один раз за показ Дома, когда пакет и игрок готовы. */
export function useStoryEntry(home: Home, off: boolean): Ref<EntryWindow | null> {
  const open = ref<EntryWindow | null>(null);
  let done = false;

  function enter(input: HomeInput | null): void {
    const pid = home.player.value?.pid;
    const got = entryCtxOf({ off, done, status: home.session.status.value, pid, input, sections: () => paperSectionsOf(home.data, pid ?? '') });
    if (got === null) return;
    done = true;
    const entered = enterHome(got.sections.story, got.ctx);
    if (entered.story !== got.sections.story) home.session.save({ story: entered.story });
    open.value = entered.window;
  }
  watch(home.input, enter, { immediate: true });
  return open;
}
