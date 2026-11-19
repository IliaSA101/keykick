/**
 * Окно учебной игры на стенде кадров (067 Т17, К-Г): из фикстуры (`fx.learn` + разделы сохранения) собирает то, что нужно `LearnWindow`.
 * Состояние — из настоящих правил (`frameFlow`): безошибочная игра до нужного места, затем промахи; никаких картинок-образцов.
 * Чистая функция: часы и зерно — из фикстуры. Урок и выученные буквы фикстура приносит сама (`learnCtx`): пакет уроков в сборку не входит.
 */
import { rivalBodyOf } from '../../engine/club/rival';
import { rivalOf } from '../../engine/cup/teams';
import { frameFlow } from '../../app/learn/frame';
import { learnCtxOf, type LearnFlow } from '../../app/learn/run';
import { ARENA_ASPECT, beforeOf, stakeOf, type Miss } from '../../app/learn/view';
import type { Learn } from '../../engine/learn/section';
import type { Step } from '../../engine/learn/steps';
import type { FrameFixture } from './frameSession';

export interface LearnStand {
  flow: LearnFlow;
  miss: Miss | null;
  before: { step: Step; best: number | null };
  stake: number;
  /** Цвет формы наших фишек — клуб кадров (зелёно-белый, 023-Р30). */
  kitBody: string;
  /** Цвет соперника по форме клуба кадров (067-Р105). */
  rivalBody: string;
  layout: string;
}

interface CourseData {
  lessons: Record<string, { best?: number }>;
}

/** `null` — у фикстуры нет учебной игры или игра по её разделам не открывается (стенд скажет «нет экрана»). */
export function learnStandOf(fx: Pick<FrameFixture, 'learn' | 'learnCtx' | 'sections' | 'clock' | 'seed'>): LearnStand | null {
  const spec = fx.learn;
  const at = fx.learnCtx;
  if (spec === undefined || at === undefined) return null;
  const course = fx.sections['course:ru'] as CourseData;
  const learn = (fx.sections.learn ?? { games: {}, recent: [] }) as Learn;
  const ctx = learnCtxOf({
    lesson: at.lesson,
    keys: at.keys,
    school: { tours: [] },
    entries: [],
    bests: Object.values(course.lessons).map((l) => l.best ?? 0),
    now: fx.clock.now,
    day: fx.clock.day,
  });
  const made = frameFlow(spec, ctx, fx.seed, fx.clock.now, ARENA_ASPECT);
  if (made === null) return null;
  const club = fx.sections.club as { kit: { body: string; alt?: string } };
  return { flow: made.flow, miss: made.miss, before: beforeOf(learn, spec.game), stake: stakeOf(ctx, learn, spec.game), kitBody: club.kit.body, rivalBody: rivalBodyOf(rivalOf(at.lesson), club.kit), layout: 'jcuken-win' };
}
