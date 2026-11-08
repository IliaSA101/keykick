/**
 * Транзакция разделов сохранения для приложения (спека 018 design §4.1): слой `tx.ts`, привязанный к
 * хранилищу игры и текущему игроку. Писатели (017, 021, 026) зовут `updatePlayer`; экраны читают `readSection`/`sectionRef`.
 */
import { activeId, onActiveSave } from '../players/active';
import { saveContext, saveStore } from './instance';
import { registry } from './registry';
import { createSectionLayer } from './tx';

export type { JournalSink, PendingJournal } from './tx';

const layer = createSectionLayer({
  store: saveStore,
  registry,
  ctx: saveContext,
  currentId: activeId,
  freeze: import.meta.env.DEV || import.meta.env.MODE === 'test',
});

// Другая вкладка записала — освежить `sectionRef` (подписка прогресса → слой; обратного импорта нет).
onActiveSave(layer.refreshRefs);

export const { updatePlayer, updateSection, readSection, sectionRef, refreshRefs, canWrite, setJournalSink, pendingJournal } = layer;
