/**
 * Реестр разделов сборки (060 design §3) — единственное место, где перечислены подсистемы сохранения.
 * Ядро (`src/engine/save/`) не знает ни одного раздела; подсистема добавляет сюда свой `SectionDef`.
 * Этап Э1 (063-Р6): `club`, `course:ru`, `seen`; волна 2 (065-Т2, Т5): `wallet`, `day`, `school`, `form`, `stadium`; волна 4 (067 Т1): `path`, `album`, `shop`, `learn`, `base`, `school` v2; Т24: `coach`; остальные задачи экранов добавляют свой раздел.
 */
import { albumDef } from '../../engine/album/section';
import { baseDef } from '../../engine/base/section';
import { coachDef } from '../../engine/coach/section';
import { clubDef } from '../../engine/club/section';
import { dayDef } from '../../engine/day/section';
import { formDef } from '../../engine/form/section';
import { stadiumDef } from '../../engine/home/section';
import { walletDef, type Wallet } from '../../engine/rewards/section';
import { learnDef } from '../../engine/learn/section';
import { pathDef } from '../../engine/path/section';
import { shopDef } from '../../engine/shop/section';
import { schoolDef } from '../../engine/school/section';
import { ruCourseDef } from '../../engine/course/section';
import type { SectionDef } from '../../engine/save/section';
import { seenDef } from '../../engine/seen/section';

export const SECTIONS: readonly SectionDef<unknown>[] = [clubDef, ruCourseDef, seenDef, walletDef, dayDef, schoolDef, formDef, stadiumDef, pathDef, albumDef, shopDef, learnDef, baseDef, coachDef] as readonly SectionDef<unknown>[];

/**
 * Кошелёк игрока для чтения (063 С1): экран не импортирует раздел `wallet`, а берёт баланс здесь, в слое app.
 * Запись монет — только касса (`engine/rewards/cash.ts`). Нет раздела или игрока — пустой кошелёк.
 */
export function walletOf(sections: Readonly<Record<string, { data: unknown } | undefined>> | undefined): Wallet {
  return (sections?.[walletDef.name]?.data as Wallet | undefined) ?? walletDef.empty();
}
