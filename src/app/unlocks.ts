// План открытий: данные — в content/unlocks.json, проверка — в движке (тест падает на битом плане).
// Ниже — то, что из плана нужно экранам: «Скоро» на главной, открытое матчем — в итоге (спека 002, Т3),
// подписи возможностей и «Новое!» (спека 005).
import unlocksJson from '../content/unlocks.json';
import { cupOfUnlock, openUnlocks, parseUnlocks, unlocksOf, upcoming, type UnlockId } from '../engine/unlocks';
import { ru } from '../i18n/ru';
import { lessons } from './lessons';
// Круг импортов (progress берёт plan отсюда) безопасен: progress здесь нужен только внутри функций.
import { progress } from './progress';

export const plan = parseUnlocks(unlocksJson, lessons);

type FeatureText = Record<string, string | undefined>;

/** Возможность из id открытия («feature:midPenalty» → «midPenalty»); раунд кубка — null. */
function featureOf(id: UnlockId): string | null {
  return id.startsWith('feature:') ? id.slice('feature:'.length) : null;
}

/** Подпись открытия: «1/8 финала кубка», «пенальти посреди матча»; возможность без текста — null. */
export function unlockLabel(id: UnlockId): string | null {
  const cup = cupOfUnlock(id);
  if (cup) return ru.unlocks.cup[cup.stage];
  const feature = featureOf(id);
  return feature ? ((ru.unlocks.features as FeatureText)[feature] ?? null) : null;
}

/** Строка итога урока-вехи: «Открыт 1/8 финала кубка!», «Новое: пенальти в матче!»; без текста — null. */
export function openedText(id: UnlockId): string | null {
  const feature = featureOf(id);
  if (feature) return (ru.unlocks.featureOpened as FeatureText)[feature] ?? null;
  const name = unlockLabel(id);
  return name ? `${ru.unlocks.opened} ${name}!` : null;
}

/**
 * «Новое!» у возможности: игрок на первом уроке после её вехи (как у кубка — без нового поля
 * сохранения, 002-Р22). Переигровки ранних уроков и дальше — уже не новое.
 */
export function featureFresh(id: string): boolean {
  const u = unlocksOf(plan, lessons).find((x) => x.id === `feature:${id}`);
  return u !== undefined && progress.lessonIndex === u.at + 1;
}

/**
 * «Скоро» на главной: что откроется, номер урока-вехи (с 1), сколько уроков пройти (1 — этот); нечего — null.
 * У раунда кубка — и лига: «1/8 финала кубка районной лиги» (рядом может стоять кнопка дворового кубка).
 */
export function soon(): { label: string; lesson: number; left: number } | null {
  const next = upcoming(progress, lessons, plan);
  const cup = next && cupOfUnlock(next.id);
  const label = cup ? `${ru.unlocks.cup[cup.stage]} ${ru.cup.leagues[cup.league]}` : next && unlockLabel(next.id);
  return next && label ? { label, lesson: next.lesson, left: next.left } : null;
}

/** Открытое у игрока сейчас: снимок до матча и после — разница и есть открытое матчем. */
export function openNow(): UnlockId[] {
  return openUnlocks(progress, lessons, plan);
}
