/**
 * Цепочки сохранения: сторож видит нарушение (спека 018-Т5). Каждому из семи инвариантов — действие-нарушитель, которое
 * сторож обязан поймать с семенем, шагом и номером инварианта. Окружение и прогон — tests/chain/run.ts; сами цепочки по семенам —
 * tests/saveChain.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { section as courseSection } from '../src/engine/course/save';
import { section as schoolSection } from '../src/engine/school/save';
import type { SectionTx } from '../src/engine/save/section';
import { section as walletSection } from '../src/engine/wallet/save';
import { credit } from '../src/engine/wallet/wallet';
import { edit, type ChainAction } from './chain/types';
import { PLAYERS, common, inTx, runChain, type Step, type Tab } from './chain/run';

describe('цепочки: сторож видит нарушение', () => {
  const run = (act: ChainAction, extra: Partial<Step> = {}): string => {
    const step = { ...inTx(act), ...extra };
    try {
      runChain(1, 3, [step]);
    } catch (e) {
      return (e as Error).message;
    }
    return '';
  };
  const bad = (name: string, fn: (tx: SectionTx) => void): ChainAction => ({ name, rewards: [], run: (tx) => fn(tx) });

  // Ловит: сторож инварианта 4 слепнет — монеты мимо объявленной награды проходят.
  it('4: монеты без награды в rewards', () => {
    const msg = run(bad('bad.coins', (tx) => tx.set(walletSection, { coins: 5, pressRest: 0, stakeRest: 0, earned: 5, spent: 0 })));
    expect(msg).toMatch(/семя 1, шаг 0, действие bad\.coins: инвариант 4/);
  });
  // Ловит: сторож инварианта 4 слепнет для звёзд курса — звёзды мимо объявленной награды stars проходят.
  it('4: звёзды без награды в rewards', () => {
    const msg = run(
      bad('bad.stars', (tx) => {
        const c = edit(tx, courseSection);
        c.lessons['yard-01'] = { stars: 3, cpm: 50, acc: 900, fails: 0, help: 'none', back: false };
        tx.set(courseSection, c);
      }),
    );
    expect(msg).toMatch(/семя 1, шаг 0, действие bad\.stars: инвариант 4 — .*stars/);
  });
  // Ловит: сторож инварианта 6 слепнет — память вкладки, разошедшаяся с лежащим, проходит (проверка на каждом 20-м шаге).
  it('6: память не равна лежащему', () => {
    const stale: Step = {
      name: 'stale',
      rewards: ['coins'],
      // Вторая вкладка пишет на диск без уведомления первой: память первой остаётся старой.
      run: (env) => env.b.updatePlayer((tx) => credit(tx, 5, 'prize', 'tab')),
    };
    let msg = '';
    try {
      runChain(1, 20, [stale]);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toMatch(/шаг 19, действие stale: инвариант 6 — память игрока p1/);
  });
  // Ловит: сторож инварианта 7 слепнет — потерянное зачисление второй вкладки или запись первой после чужой кассы проходят.
  it('7: secondTab видит потерю зачисления второй вкладки и записи первой', () => {
    const second = common.find((s) => s.name === 'secondTab') as Step;
    const noop = (): void => undefined;
    const lostB: Step = { ...second, run: (env, rnd, ctx, clock) => second.run({ ...env, b: { ...env.b, updatePlayer: noop } as Tab }, rnd, ctx, clock) };
    const lostA: Step = { ...second, run: (env, rnd, ctx, clock) => second.run({ ...env, a: { ...env.a, updatePlayer: noop } as Tab }, rnd, ctx, clock) };
    const fail = (step: Step): string => {
      try {
        runChain(1, 3, [step]);
      } catch (e) {
        return (e as Error).message;
      }
      return '';
    };
    expect(fail(lostB)).toMatch(/действие secondTab: инвариант 7 — зачисление второй вкладки/);
    expect(fail(lostA)).toMatch(/действие secondTab: инвариант 7 — запись первой вкладки/);
  });
  // Ловит: сторож инварианта 3 слепнет — убывший счётчик проходит.
  it('3: счётчик убыл', () => {
    const grow: ChainAction = { name: 'grow', rewards: [], run: (tx) => tx.set(schoolSection, { solved: 'B', expert: 4 }) };
    const drop = bad('bad.drop', (tx) => tx.set(schoolSection, { solved: 'B', expert: 1 }));
    let i = 0;
    const alt: Step = { name: 'alt', rewards: [], run: (env, rnd, ctx, clock) => (i++ === 0 ? inTx(grow) : inTx(drop)).run(env, rnd, ctx, clock) };
    expect(run(grow, alt)).toMatch(/действие alt: инвариант 3/);
  });
  // Ловит: сторож инварианта 2 слепнет — дробь в разделе проходит.
  it('2: дробное число', () => {
    expect(run(bad('bad.frac', (tx) => tx.set(schoolSection, { solved: '', expert: 1.5 })))).toMatch(/инвариант 2/);
  });
  // Ловит: сторож инварианта 1 слепнет — раздел, нарушающий check, проходит.
  it('1: check раздела', () => {
    expect(run(bad('bad.check', (tx) => tx.set(walletSection, { coins: 9, pressRest: 0, stakeRest: 0, earned: 1, spent: 0 })))).toMatch(/инвариант 1/);
  });
  // Ловит: сторож инварианта 5 слепнет — запись в ключ чужого игрока проходит.
  it('5: запись в чужой ключ', () => {
    const msg = run(bad('bad.other', () => undefined), {
      run: (env, _rnd, ctx) => env.a.updatePlayer((tx) => tx.set(schoolSection, { solved: 'B', expert: 2 }), { player: PLAYERS.find((p) => p !== ctx.player) as string }),
    });
    expect(msg).toMatch(/инвариант 5/);
  });
});
