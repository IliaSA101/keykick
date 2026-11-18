/** «Сохранить файл» страницы родителя — из плашки напоминания и из блока «Файл сохранения» одним путём (063 Т12): файл и отметка выгрузки. */
import { saveClubFile } from '../../app/save/exportFile';
import { useSession } from '../../app/save/session';

/** `saved` — файл скачан и день выгрузки записан; `fail` — файла нет или отметка не легла. */
export function saveFileNow(): 'saved' | 'fail' {
  const out = saveClubFile(useSession(), new Date(), globalThis.location.origin + globalThis.location.pathname);
  return out.ok && out.marked ? 'saved' : 'fail';
}
