// Бутсы шкафчика: данные — в content, проверка — в движке (тест падает на ошибке в JSON).
import bootsJson from '../content/boots.json';
import { BASIC_BOOTS_ID, parseBoots, type Boots } from '../engine/boots';

export const boots = parseBoots(bootsJson);

function basic(): Boots {
  const b = boots.find((x) => x.id === BASIC_BOOTS_ID);
  if (!b) throw new Error('boots: no basic');
  return b;
}

/** Обычные бутсы — у соперника в матче (parseBoots ручается, что они есть). */
export const basicBoots = basic();
