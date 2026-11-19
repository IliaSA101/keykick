<script setup lang="ts">
/**
 * Окно «Клуб» (067 Т11, ТЗ-1.13, 5.13; кадры Э2К.32, 36, 38): пункт меню «Клуб» — окно над размытым двором, а не страница.
 * Форма спереди и сзади, название, город, «На спине», тренер со «Сменить ›», статистика; «Изменить» открывает «Твой клуб»
 * (общее окно с первым запуском, `components/club`), «Сменить ›» — выбор тренера. Закрыть (Esc) — домой. Запись клуба — через
 * сеанс (`session.save({ club })`), раздел тот же, что у первого запуска. Окна не стоят вместе: Esc в одном закрывает только его.
 */
import { computed, inject, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useClubEdit, stored } from '../../app/club/edit';
import { providedHardKeys } from '../../app/club/provide';
import { useHomeInput } from '../../app/home/useHomeInput';
import ClubEditWindow from '../../components/club/ClubEditWindow.vue';
import ClubRow from '../../components/club/ClubRow.vue';
import ClubShirts from '../../components/club/ClubShirts.vue';
import { CLUB_WINDOW } from '../../components/club/places';
import HomeBackdrop from '../../components/home/HomeBackdrop.vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitModal from '../../components/panel/KitModal.vue';
import { ENTER_DELAY } from '../../components/panel/focusCycle';
import { backLine, clubCard, swapCoach } from '../../engine/club/card';
import { clubDef, type Club } from '../../engine/club/section';
import { COACHES, DEFAULT_COACH } from '../../engine/club/start';
import type { CoachKeys } from '../../engine/coach/section';
import type { Day } from '../../engine/day/section';
import type { Stadium } from '../../engine/home/section';
import type { School } from '../../engine/school/section';
import { ru } from '../../i18n/ru';
import ClubStats from './ClubStats.vue';
import CoachSwap from './CoachSwap.vue';

/** Стенд кадров: трудные клавиши и открытое окно кадра. В игре — null. */
const stand = inject<(() => { hardKeys?: string[]; win?: 'edit' | 'swap' }) | null>('kk-club-stand', null)?.() ?? null;
const router = useRouter();
const { session, input, data } = useHomeInput();
const club = computed<Club>(() => data<Club>('club', clubDef.empty()));
const card = computed(() =>
  clubCard({
    played: data<Day>('day', { played: 0, days: 0, today: null, todayN: 0, last: null }).played,
    goals: data<Stadium>('stadium', { fans: 0, goals: 0 }).goals,
    solved: data<School | null>('school', null)?.solved.length ?? 0,
    course: data('course:ru', { lessons: {}, archive: {} }),
    hardKeys: stand?.hardKeys ?? providedHardKeys({ coach: data<CoachKeys | null>('coach', null) }),
  }),
);
const coach = computed(() => (COACHES.some((c) => c.id === club.value.coach) ? club.value.coach : DEFAULT_COACH));
const back = computed(() => backLine(club.value.backName, club.value.backNumber));
const shirtBack = computed(() => ({ name: club.value.backName, number: club.value.backNumber }));

/** Вторая вкладка и прочие отказы записи: окно только для просмотра (design §6) — «Изменить» и «Сменить ›» погашены. */
const editable = computed(() => session.status.value === 'ok');
const win = ref<'card' | 'edit' | 'swap'>(stand?.win ?? 'card');
const { draft, open, save: saveClub } = useClubEdit(session, club, coach);

function openEdit(): void {
  open();
  win.value = 'edit';
}
if (win.value === 'edit') openEdit(); // стенд кадров открывает окно сразу: черновик — текущий клуб, как после «Изменить»
/** «Сохранить»: клуб из черновика; отказ записи (чужая вкладка) окно не закрывает. */
function save(): void {
  if (saveClub()) win.value = 'card';
}
function pick(id: string): void {
  const next = swapCoach(coach.value, id, COACHES.map((c) => c.id));
  if (next === null) {
    win.value = 'card'; // тот же тренер — ничего не пишем
    return;
  }
  if (stored(session.save({ club: { ...club.value, coach: next } }))) win.value = 'card';
}
</script>

<template>
  <main class="club">
    <HomeBackdrop
      v-if="input"
      mode="scene"
      :input="input"
      :kit="club.kit"
    />
    <KitModal
      v-if="win === 'card'"
      :title="ru.frame.menu.club"
      :width="CLUB_WINDOW.width"
      :top="CLUB_WINDOW.top"
      :enter-delay="ENTER_DELAY"
      left
      @close="router.push('/home')"
    >
      <template #head>
        <KeyButton
          quiet
          :sub="ru.kit.esc"
          @click="router.push('/home')"
        >
          {{ ru.kit.close }}
        </KeyButton>
      </template>
      <div class="cw">
        <div class="left">
          <ClubShirts
            :kit="club.kit"
            :back="shirtBack"
            :label="ru.frame.menu.club"
          />
          <ClubRow
            as="div"
            :label="ru.start.club.name"
          >
            <b>«{{ club.name }}»</b>
          </ClubRow>
          <ClubRow
            as="div"
            :label="ru.start.club.city"
          >
            <b>{{ club.city || '—' }}</b>
          </ClubRow>
          <ClubRow
            as="div"
            :label="ru.club.onBack"
          >
            <b>{{ back || '—' }}</b>
          </ClubRow>
        </div>
        <ClubStats
          :card="card"
          :coach="coach"
          :locked="!editable"
          @swap="win = 'swap'"
        />
      </div>
      <template #buttons>
        <KeyButton
          quiet
          :state="editable ? undefined : 'off'"
          @click="openEdit"
        >
          {{ ru.club.edit }}
        </KeyButton>
      </template>
    </KitModal>
    <ClubEditWindow
      v-else-if="win === 'edit'"
      v-model:draft="draft"
      @save="save"
      @cancel="win = 'card'"
    />
    <CoachSwap
      v-else
      :current="coach"
      @pick="pick"
      @back="win = 'card'"
    />
  </main>
</template>

<style scoped>
/* числа — единицы макета из генератора Э2К.32 (e2k-club.mjs, collection-e.css и collection-e-club.css); множителя нет */
.club {
  position: absolute;
  inset: 0;
}
.cw {
  display: flex;
  gap: 18px;
  text-align: left;
}
.left {
  flex: 0 0 340px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
</style>
