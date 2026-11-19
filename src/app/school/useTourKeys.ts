import { onMounted, onUnmounted } from 'vue';

/**
 * Клавиши листа Школы (тур и «штрафные»): Esc — `esc`; Enter — `act`, пока `active()`: кнопки с `data-act` жмут сами
 * (иначе двойной ответ), повтор клавиши (`repeat`) не отвечает. Слушатель живёт, пока жив экран.
 */
export function useTourKeys(h: { esc: () => void; active: () => boolean; act: () => void }): void {
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') return h.esc();
    if (e.key !== 'Enter' || !h.active()) return;
    if (e.target instanceof HTMLButtonElement && e.target.dataset.act !== undefined) return;
    e.preventDefault();
    if (!e.repeat) h.act();
  }
  onMounted(() => globalThis.addEventListener('keydown', onKey));
  onUnmounted(() => globalThis.removeEventListener('keydown', onKey));
}
