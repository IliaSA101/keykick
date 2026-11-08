/**
 * Страница родителя на разделах v2 (спека 018-Т6б2): что показать об игроке и как поставить ему урок.
 * Чистые функции над разделами сохранения; запись — `updatePlayer` в app-слое.
 */
import { hasClub } from '../club/create';
import { section as clubSection } from '../club/save';
import { section as courseSection, type CourseSave } from '../course/save';
import { section as matchSection } from '../match/save';
import { coinsOf, walletKey, type WalletSave } from '../wallet/view';

/** Всё, что родитель видит об игроке: урок, монеты, ошибки клавиш, клуб. */
export interface ParentView {
  /** id текущего урока курса; '' — первый урок. */
  lessonId: string;
  coins: number;
  keyErrors: Readonly<Record<string, number>>;
  /** Пройденные уроки курса. */
  passed: readonly string[];
  /** Название клуба; '' — клуб ещё не создан. */
  clubName: string;
}

/** Разделы игрока (как лежат в слое; нет раздела — берётся пустой) → вид для родителя. */
export function parentView(sections: Readonly<Record<string, unknown>>): ParentView {
  const club = clubSection.parse(sections[clubSection.name], {});
  return {
    lessonId: courseSection.parse(sections[courseSection.name], {}).lesson,
    coins: coinsOf(sections[walletKey.name] as WalletSave | undefined),
    passed: courseSection.parse(sections[courseSection.name], {}).passed,
    keyErrors: matchSection.parse(sections[matchSection.name], {}).keyErrors,
    clubName: hasClub(club) ? club.name : '',
  };
}

/** Номер урока в курсе с 0 по его id; пусто или неизвестный id — первый урок (0). */
export function lessonIndexOf(lessonId: string, lessonIds: readonly string[]): number {
  return Math.max(0, lessonIds.indexOf(lessonId));
}

/** Номер первого не пройденного урока; все пройдены — последний (родителю есть куда встать). */
export function firstOpenIndex(passed: readonly string[], lessonIds: readonly string[]): number {
  const have = new Set(passed);
  const i = lessonIds.findIndex((id) => !have.has(id));
  return i < 0 ? Math.max(0, lessonIds.length - 1) : i;
}

/**
 * Родитель ставит урок для проверки (018-Р31): только вперёд — на первый не пройденный урок или дальше. Уроки до
 * выбранного засчитываются пройденными (карта «Путь клуба» смотрит на `passed`); назад `passed` не снимается,
 * поэтому выбор раньше первого не пройденного — отказ (сохранение как было), пройденное ребёнок переигрывает на карте.
 * Номер за границами зажимается; пустой курс — без изменений.
 */
export function setLesson(course: CourseSave, index: number, lessonIds: readonly string[]): CourseSave {
  const clamped = Math.min(Math.max(Number.isInteger(index) ? index : 0, 0), lessonIds.length - 1);
  const target = lessonIds[clamped];
  if (target === undefined || clamped < firstOpenIndex(course.passed, lessonIds)) return course;
  const have = new Set(course.passed);
  const added = lessonIds.slice(0, clamped).filter((id) => !have.has(id));
  if (course.lesson === target && added.length === 0) return course;
  return { ...course, lesson: target, passed: [...course.passed, ...added] };
}
