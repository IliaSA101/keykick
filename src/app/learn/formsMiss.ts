/**
 * Что сказать на красной полосе игр 5–8 (067-Р142): конкретная причина промаха — какая отметка лишняя, какая позиция у игрока, какая линия верна.
 * Чистая функция: задача и ввод приходят из `FormsState` движка, слова — `ru.learn.formsMiss` (подстановки — `fill`).
 */
import forms from '../../content/learn-forms.json';
import type { FormsAction, FormsState } from '../../engine/learn/forms';
import type { TaskAnswer } from '../../engine/school/answers';
import { ru } from '../../i18n/ru';
import { fill } from '../home/texts';

const T = ru.learn.formsMiss;

/** Расцветка формы словами («зелёная с белым») по id формы из `kits.json`; нет — пусто. */
export const kitLook = (id: string): string => forms.kits.find((k) => k.id === id)?.look ?? '';

/** Имя пальца для слов: из `ru.keyboard.fingers`, нет — сам id (одно место для полосы промаха и арены «Пар»). */
export const fingerName = (id: string): string => (ru.keyboard.fingers as Record<string, string>)[id] ?? id;

/** Игрок по имени: номер в Коллекции и порядок вырезки `albumPlayerNN` (1…8); нет такого — `null`. */
export function playerCard(name: string): { num: number; file: number } | null {
  const i = forms.players.findIndex((p) => p.name === name);
  return i < 0 ? null : { num: forms.players[i]!.num, file: i + 1 };
}

/** Строка варианта для слов: у форм — «красная форма» (цвет — первое слово расцветки), у остальных — как есть. */
function label(a: TaskAnswer, i: number): string {
  if (a.kind === 'pictures') return fill(T.kit, { color: kitLook(a.pictures[i] ?? '').split(' ')[0] ?? '' });
  return a.kind === 'choice' || a.kind === 'multi' ? (a.options[i] ?? '') : '';
}

/** Левое имя в паре «Пар»: у пальцев — слово, у игроков — как есть. */
const leftName = (id: string, refs: string): string => (refs === 'finger' ? fingerName(id) : id);

/** Строка промаха для действия `action` в состоянии `s` (до действия); `null` — нет конкретной причины, экран берёт общую. */
export function formsMissText(s: FormsState, action: FormsAction): string | null {
  const task = s.tasks[s.round];
  if (task === undefined) return null;
  const a = task.answer;
  if (action.type === 'link' && a.kind === 'match') {
    return fill(T.line, { left: leftName(a.left[action.left] ?? '', task.refs), right: a.right[a.pairs[action.left] ?? 0] ?? '', wrong: a.right[action.right] ?? '' });
  }
  if (action.type !== 'submit') return null;
  const v = s.input;
  if ((a.kind === 'multi' || a.kind === 'pictures') && (v.kind === 'multi' || v.kind === 'pictures')) {
    const extra = v.value.find((i) => !a.correct.includes(i));
    if (extra !== undefined) return fill(T.extra, { what: label(a, extra) });
    const lack = a.correct.find((i) => !v.value.includes(i));
    return lack === undefined ? null : fill(T.lack, { what: label(a, lack) });
  }
  if (a.kind === 'choice' && v.kind === 'choice' && v.value !== null) return fill(T.pick, { what: label(a, v.value) });
  if (a.kind === 'select' && v.kind === 'select') {
    const [name, poss, nums] = a.row as [string, string[], string[]];
    const [rp, rn] = a.correct;
    const [gp, gn] = v.value;
    if (gp !== rp) return fill(T.pos, { name, right: poss[rp ?? 0] ?? '', wrong: poss[gp ?? 0] ?? '' });
    return fill(T.num, { name, right: nums[rn ?? 0] ?? '', wrong: nums[gn ?? 0] ?? '' });
  }
  if (a.kind === 'fields' && v.kind === 'fields') {
    const i = a.fields.findIndex((f, k) => Number(v.value[k]) !== f.value);
    return i < 0 ? null : fill(T.field, { label: a.fields[i]!.label });
  }
  if (a.kind === 'expr' && v.kind === 'expr') {
    const i = a.values.findIndex((x, k) => Number(v.value[k]) !== x);
    return i < 0 ? null : fill(T.slot, { n: String(i + 1) });
  }
  return a.kind === 'fraction' ? T.fraction : null;
}
