<script setup lang="ts">
// Первый запуск (спека 019, design §3, Р1–Р3): карточка → клуб (название, форма) → город → «Готово» = одна запись клуба.
// До «Готово» в хранилище ничего не пишется: черновик живёт в памяти (app/firstRun). Шаги, проверку и запись считает
// app/firstRun; экран показывает и переходит. Esc на шагах 2–3 — шаг назад с черновиком, Enter — «Дальше».
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { clubRef } from '../../app/club/club';
import { recheckStorage } from '../../app/crash/crash';
import {
  AFTER_START,
  FIRST_RUN_STEPS,
  finishFirstRun,
  firstRunDraft,
  resetDraft,
  startAt,
  stepAfter,
  stepBefore,
  type FirstRunStep,
} from '../../app/firstRun/firstRun';
import { clubData } from '../../app/kits';
import { activeId } from '../../app/players/active';
import { oldVersionUrl } from '../../app/versions/build';
import ClubForm from '../../components/club/ClubForm.vue';
import KeyButton from '../../components/KeyButton.vue';
import NewSeasonCard from '../../components/firstRun/NewSeasonCard.vue';
import { hasClub, type ClubDraft } from '../../engine/club/create';
import { ru } from '../../i18n/ru';

const route = useRoute();
const router = useRouter();
const t = ru.firstRun;

// Быстрая проверка `?at=` (dev): шаг сразу, в черновике образец, охрана и «клуб появился» не уводят с экрана.
const { step: first, sample } = startAt(route.query, import.meta.env.DEV);
const step = ref<FirstRunStep>(first);
const blocked = ref(false);
// Игрок закрепляется при входе: запись идёт ему, даже если вкладка успеет сменить текущего.
const player = activeId();
const oldUrl = oldVersionUrl(import.meta.env.BASE_URL);

// Зерно названия — часы страницы: движок их не читает. Заново при каждом входе на /start.
resetDraft(
  Date.now() % 2_147_483_647,
  sample ? { name: t.sample.name, kit: clubData.palettes[1] ?? clubData.palettes[0] ?? firstRunDraft.kit, city: t.sample.city } : undefined,
);

let left = false;
/** На карту (`AFTER_START`); один раз, сколько бы событий ни пришло. */
function leave(): void {
  if (left) return;
  left = true;
  void router.replace(AFTER_START);
}

// Клуб появился из другой вкладки — делать здесь больше нечего.
watch(
  () => hasClub(clubRef.value),
  (has) => {
    if (has && !sample) leave();
  },
);

const stepNo = () => FIRST_RUN_STEPS.indexOf(step.value) + 1;

function back(): void {
  const prev = stepBefore(step.value);
  if (prev !== null) step.value = prev;
}

function submit(d: ClubDraft): void {
  Object.assign(firstRunDraft, d);
  const next = stepAfter(step.value);
  if (next !== null) {
    step.value = next;
    return;
  }
  const res = finishFirstRun(firstRunDraft, { now: Date.now(), player });
  if (res.to === 'step') step.value = res.step;
  else if (res.to === 'blocked') {
    // Писать нельзя: не на /start по кругу, а экран 014 (если слой «только чтение») и наша карточка (если игрока нет).
    blocked.value = true;
    recheckStorage();
  } else if (!sample) leave();
}

const reload = (): void => globalThis.location.reload();

onMounted(() => globalThis.scrollTo(0, 0));
</script>

<template>
  <main
    class="start"
    :data-step="blocked ? 'blocked' : step"
  >
    <section
      v-if="blocked"
      class="panel blocked"
      role="alert"
    >
      <h1>{{ t.blocked.title }}</h1>
      <p>{{ t.blocked.text }}</p>
      <KeyButton
        primary
        @click="reload"
      >
        {{ t.blocked.reload }}
      </KeyButton>
    </section>

    <NewSeasonCard
      v-else-if="step === 'card'"
      :old-url="oldUrl"
      @start="step = 'club'"
    />

    <!-- :key по шагу — тело шага пересоздаётся, и ClubForm сам ставит фокус в поле нового шага. -->
    <div
      v-else
      :key="step"
      class="step"
    >
      <header class="head">
        <button
          type="button"
          class="back"
          @click="back"
        >
          {{ t.back }}
        </button>
        <h1>{{ step === 'club' ? t.clubTitle : t.cityTitle }}</h1>
        <span class="count">{{ t.step }} {{ stepNo() }} {{ t.of }} {{ FIRST_RUN_STEPS.length }}</span>
      </header>
      <ClubForm
        :model-value="firstRunDraft"
        :part="step === 'club' ? 'club' : 'city'"
        @update:model-value="(d: ClubDraft) => Object.assign(firstRunDraft, d)"
        @submit="submit"
        @back="back"
      />
    </div>
  </main>
</template>

<style scoped>
.start {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--space-3);
  color: var(--text);
}

.head {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  margin-bottom: var(--space-3);
}

h1 {
  flex: 1;
  margin: 0;
  font-size: 1.8rem;
}

.count {
  color: var(--text-muted);
  font-weight: 700;
}

.back {
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 3px solid var(--field-border);
  border-radius: 12px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.back:focus-visible {
  outline: 4px solid var(--text);
  outline-offset: 2px;
}

.blocked {
  max-width: 640px;
  margin: var(--space-5) auto 0;
  text-align: center;
}
</style>
