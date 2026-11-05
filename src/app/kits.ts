// Формы коллекции, палитры и слова для названий клубов: данные — в content, проверка — в движке
// (тест падает на ошибке в JSON).
import clubsJson from '../content/clubs.json';
import kitsJson from '../content/kits.json';
import { parseClubData } from '../engine/club';
import { parseKits } from '../engine/kit';

export const kits = parseKits(kitsJson);
export const clubData = parseClubData(clubsJson);
