/**
 * Клуб в файл по кнопке: страница родителя («Сохранить клуб в файл») и окно «Позови взрослого» при квоте (063-Р5, Т11).
 * Конверт игрока вкладки берётся из ПАМЯТИ только при квоте: там то, чего на диске нет, а файл — единственный путь для него.
 * При ok, busy, conflict и во вкладке-просмотре (родитель игрока не держит) — файл целиком с диска. Часы приходят снаружи.
 */
import type { Session } from './session';
import { saveTextFile } from '../parent/download';

export type ClubFile = { ok: true; name: string; marked: boolean } | { ok: false };

/** Выгрузка и скачивание; `marked` — дата последнего файла записана в устройство (при квоте может не лечь — файл от этого не хуже). */
export function saveClubFile(session: Session, now: Date, from: string): ClubFile {
  const cur = session.player.value;
  // Память — только при квоте (запись не легла, на диске старее). При ok память равна диску; при busy (игрока держит другая вкладка)
  // и conflict (на диске чужая запись) копия вкладки устарела — берём диск (063-Р58).
  const memory = session.status.value === 'quota' && cur.kind === 'ok' ? [cur.env] : [];
  const out = session.transfer.exportText(now.toISOString(), from, memory);
  if (!out.ok || !saveTextFile(out.name, out.text)) return { ok: false };
  return { ok: true, name: out.name, marked: session.transfer.markExported(now.toLocaleDateString('sv-SE')) };
}

/** Файл одного игрока («Скачать файл Миши» перед удалением, 063-Р62): без отметки «клуб выгружен» — это не копия всего клуба. */
export function saveOnePlayerFile(session: Session, pid: string, now: Date, from: string): boolean {
  const out = session.transfer.exportText(now.toISOString(), from, [], pid);
  return out.ok && saveTextFile(out.name, out.text);
}
