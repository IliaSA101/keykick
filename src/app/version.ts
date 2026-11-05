/**
 * Номер версии игры — один источник: "version" в package.json (Vite кладёт в сборку только это поле).
 * Движок номер сам не читает: он приходит аргументом (engine/news, engine/save).
 */
import { version } from '../../package.json';

export const APP_VERSION: string = version;
