/**
 * Раздел `club` (спека 018 design §3.1, поля и починка — 019 design §2): название, форма, город, тренер, соперник.
 * Типы и разбор живут в `create.ts` (019-Т3) — здесь они сводятся в описание раздела, без второй копии.
 * Владелец — 019; пишут `createClub`, `editClub`, `markNewsSeen` только через `updatePlayer`.
 */
import clubs from '../../content/clubs.json';
import { CUSTOM_NAME_MAX } from './names';
import { defineSection, time, type SectionDef } from '../save/section';
import { CITY_MAX, emptyClub, repairClub, type ClubFields } from './create';

export type ClubSave = ClubFields;

// Город образца — из контента (русские буквы в коде вне i18n и content не пишем, страж guards.test).
const CITY = clubs.cities[0] ?? '';

export const section: SectionDef<ClubSave> = defineSection<ClubSave>({
  name: 'club',
  owner: '019',
  // Починка по правилам 019 design §2; дата зажимается как `time()` (в разборе поля у неё нет верхней границы).
  parse: (raw) => {
    const { club } = repairClub(raw);
    return { ...club, createdAt: time(club.createdAt) };
  },
  empty: () => emptyClub(),
  sample: () => ({
    name: 'Meteor',
    kit: {
      pattern: 'stripes',
      body: '#c8102e',
      alt: '#ffffff',
      sleeves: '#c8102e',
      trim: '#16161a',
      shorts: { body: '#ffffff', stripe: '#c8102e', waist: '#16161a' },
      socks: { leg: '#c8102e', top: '#ffffff', foot: '#16161a' },
    },
    city: CITY,
    coach: 'coach-1',
    rival: 'Progress',
    createdAt: 1_800_000_000_000,
    newsSeen: '2.0.0',
  }),
  // Потолок: все строки максимальной длины, форма с обеими зонами (шорты, гетры) и вторым цветом.
  maxSample: () => ({
    name: 'W'.repeat(CUSTOM_NAME_MAX),
    kit: {
      pattern: 'stripes',
      body: '#c8102e',
      alt: '#ffffff',
      sleeves: '#c8102e',
      trim: '#16161a',
      shorts: { body: '#ffffff', stripe: '#c8102e', waist: '#16161a' },
      socks: { leg: '#c8102e', top: '#ffffff', foot: '#16161a' },
    },
    city: CITY.repeat(CITY_MAX).slice(0, CITY_MAX),
    coach: 'k'.repeat(32),
    rival: 'W'.repeat(20),
    createdAt: time(Infinity),
    newsSeen: '123456.123456.12',
  }),
  // Дата создания, однажды став больше нуля, в ноль не возвращается (ТЗ-0.11).
  counters: (s) => ({ createdAt: s.createdAt }),
  // «Клуба нет» ⇒ всё пусто: имя или город при createdAt = 0 — ошибка починки (019 design §2).
  check: (s) => (s.createdAt === 0 && (s.name !== '' || s.city !== '') ? ['club: name/city set but createdAt is 0'] : []),
});
