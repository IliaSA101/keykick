/** Действия цепочек над разделом `club` (019): создание, правка, «что нового». */
import clubs from '../../src/content/clubs.json';
import { createClub, editClub, hasClub, markNewsSeen, type ClubDraft } from '../../src/engine/club/create';
import { section } from '../../src/engine/club/save';
import { edit, oneOf, type ChainAction } from './types';

const NAMES = ['Meteor', 'Comet', 'Orbit', 'Sprint'];
const BODIES = ['#c8102e', '#2f6fe0', '#16a34a', '#f59e0b'];
const VERSIONS = ['2.0.0', '2.0.1', '2.1.0', '1.9.0', 'bad'];

const draft = (rnd: () => number): ClubDraft => {
  const kit = section.sample().kit;
  return { name: oneOf(rnd, NAMES), kit: { ...kit, body: oneOf(rnd, BODIES) }, city: oneOf(rnd, clubs.cities) };
};

export const actions: ChainAction[] = [
  {
    name: 'club.create',
    rewards: [],
    run: (tx, rnd, ctx) => tx.set(section, createClub(edit(tx, section), draft(rnd), { now: ctx.now, coach: 'coach-1', version: '2.0.0' })),
  },
  // Править клуб и отмечать «что нового» можно, только когда клуб есть (экран «Мой клуб» иначе не открывается).
  {
    name: 'club.edit',
    rewards: [],
    run: (tx, rnd) => {
      const cur = edit(tx, section);
      if (hasClub(cur)) tx.set(section, editClub(cur, draft(rnd)));
    },
  },
  {
    name: 'club.news',
    rewards: [],
    run: (tx, rnd) => {
      const cur = edit(tx, section);
      if (hasClub(cur)) tx.set(section, markNewsSeen(cur, oneOf(rnd, VERSIONS)));
    },
  },
];
