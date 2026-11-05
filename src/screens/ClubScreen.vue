<script setup lang="ts">
// Свой клуб: название (набрать или «Придумать»), цвета из готовых палитр, имя и номер на спине
// (docs/design.md, «свой клуб»). Открывается при первом матче и из шкафчика.
// Облик всегда «вечерний», как на главной: цвета — прямо здесь, в стилях.
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { clubData } from '../app/kits';
import { progress, setClub } from '../app/progress';
import KeyButton from '../components/KeyButton.vue';
import KitView, { type ShirtBack } from '../components/KitView.vue';
import { checkClubName, checkShirtName, checkShirtNumber, clubKit, sameColors, suggestName, type Club } from '../engine/club';
import type { Kit } from '../engine/kit';
import { ru } from '../i18n/ru';

const router = useRouter();
const saved = progress.club;

// Старое сохранение могло хранить цвета не из нынешних палитр: они идут последним вариантом,
// чтобы «Готово» молча не заменило форму ребёнка.
const savedKit = saved?.kit ?? null;
const palettes =
  savedKit && !clubData.palettes.some((p) => sameColors(p, savedKit))
    ? [...clubData.palettes, savedKit]
    : clubData.palettes;

const clubName = ref(saved?.name ?? '');
const paletteIndex = ref(Math.max(0, savedKit ? palettes.findIndex((p) => sameColors(p, savedKit)) : 0));
const shirtName = ref(saved?.shirtName ?? '');
const shirtNumber = ref(saved?.shirtNumber === undefined ? '' : String(saved.shirtNumber));
/** Ошибку «слишком коротко» показываем после попытки, а не на первой же букве. */
const touched = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);

const palette = computed(() => palettes[paletteIndex.value] ?? palettes[0]);
const nameCheck = computed(() => checkClubName(clubName.value));
const shirtNameCheck = computed(() => checkShirtName(shirtName.value));
const shirtNumberCheck = computed(() => checkShirtNumber(shirtNumber.value));

/** Пустое поле и «слишком коротко» — только после попытки сохранить или ухода из поля. */
const nameError = computed(() => {
  const check = nameCheck.value;
  if (check.ok) return null;
  if (clubName.value.trim() === '') return touched.value ? ru.club.nameErrors.empty : null;
  if (check.error === 'short' && !touched.value) return null;
  return ru.club.nameErrors[check.error];
});

const shirtNameError = computed(() => {
  const name = shirtNameCheck.value;
  return !name.ok && (name.error !== 'short' || touched.value) ? ru.club.shirtErrors[name.error] : null;
});
const shirtNumberError = computed(() => (shirtNumberCheck.value.ok ? null : ru.club.shirtErrors.number));
const shirtError = computed(() => shirtNameError.value ?? shirtNumberError.value);

/** Что сохранит «Готово»; null — пока что-то не так. */
const choice = computed<Club | null>(() => {
  const name = nameCheck.value;
  const sName = shirtNameCheck.value;
  const sNumber = shirtNumberCheck.value;
  if (!name.ok || !sName.ok || !sNumber.ok || !palette.value) return null;
  const club: Club = { name: name.name, kit: palette.value };
  if (sName.name !== '') club.shirtName = sName.name;
  if (sNumber.number !== null) club.shirtNumber = sNumber.number;
  return club;
});

const preview = computed<Kit | null>(() =>
  palette.value ? clubKit({ name: clubName.value.trim() || ru.club.colors, kit: palette.value }) : null,
);

// Пока имя или номер с ошибкой — на спине то, что уже годится.
const back = computed<ShirtBack>(() => ({
  name: shirtNameCheck.value.ok ? shirtNameCheck.value.name : '',
  number: shirtNumberCheck.value.ok ? shirtNumberCheck.value.number : null,
}));

// Название с ошибкой тоже видно как есть: «Напиши название», когда оно написано, сбивает с толку.
const previewName = computed(() => clubName.value.trim() || ru.club.pickName);

const variants = palettes.map(
  (p, i): Kit => ({ id: `palette-${i}`, name: `${ru.club.palette} ${i + 1}`, rarity: 'common', ...p }),
);

/** «Придумать»: новое название в поле; фокус остаётся на кнопке — можно жать ещё. */
function suggest(): void {
  clubName.value = suggestName(clubData, clubName.value, Date.now() % 2147483647);
  touched.value = false;
}

function done(): void {
  touched.value = true;
  const club = choice.value;
  if (!club) {
    // Что-то не так — ошибка уже под полем; с названием — сразу в поле, чтобы исправить.
    if (!nameCheck.value.ok) nameInput.value?.focus();
    return;
  }
  setClub(club);
  // Первый раз клуб выбирают по пути на матч; потом сюда заходят из шкафчика — туда и вернуть.
  void router.push(saved ? '/locker' : '/match');
}

onMounted(() => {
  if (!saved) void nextTick(() => nameInput.value?.focus());
});
</script>

<template>
  <section class="club">
    <div class="layout">
      <div class="panel main">
        <header class="head">
          <h1>{{ ru.club.title }}</h1>
          <p class="hint">
            {{ saved ? ru.club.editHint : ru.club.hint }}
          </p>
        </header>

        <label
          for="club-name"
          class="label"
        >{{ ru.club.name }}</label>
        <div class="name-row">
          <input
            id="club-name"
            ref="nameInput"
            v-model="clubName"
            class="field name-input"
            type="text"
            maxlength="30"
            autocomplete="off"
            spellcheck="false"
            :placeholder="ru.club.namePlaceholder"
            :aria-invalid="nameError !== null"
            aria-describedby="club-name-hint club-name-error"
            @blur="touched = true"
            @keydown.enter.prevent="done"
          >
          <button
            type="button"
            class="suggest"
            @click="suggest"
          >
            {{ ru.club.suggest }}
          </button>
        </div>
        <p
          id="club-name-hint"
          class="small-hint"
        >
          {{ ru.club.nameHint }}
        </p>
        <p
          id="club-name-error"
          class="error"
          aria-live="polite"
        >
          {{ nameError ?? '' }}
        </p>

        <h2>{{ ru.club.colors }}</h2>
        <div
          class="variants"
          role="radiogroup"
          :aria-label="ru.club.colors"
        >
          <button
            v-for="(v, i) in variants"
            :key="v.id"
            type="button"
            role="radio"
            class="variant"
            :class="{ chosen: i === paletteIndex }"
            :aria-checked="i === paletteIndex"
            :aria-label="v.name"
            @click="paletteIndex = i"
          >
            <KitView :kit="v" />
          </button>
        </div>
      </div>

      <aside class="panel preview">
        <h2>{{ ru.club.homeKit }}</h2>
        <div
          v-if="preview"
          class="shirts"
        >
          <figure>
            <KitView :kit="preview" />
            <figcaption>{{ ru.club.front }}</figcaption>
          </figure>
          <figure>
            <KitView
              :kit="preview"
              :back="back"
            />
            <figcaption>{{ ru.club.back }}</figcaption>
          </figure>
        </div>
        <span class="preview-name">{{ previewName }}</span>

        <div class="shirt-fields">
          <label class="shirt-field grow">
            <span class="label small">{{ ru.club.shirtName }}</span>
            <input
              v-model="shirtName"
              class="field shirt-input"
              type="text"
              maxlength="16"
              autocomplete="off"
              spellcheck="false"
              :placeholder="ru.club.shirtNamePlaceholder"
              :aria-invalid="shirtNameError !== null"
              aria-describedby="club-shirt-hint club-shirt-error"
              @blur="touched = true"
              @keydown.enter.prevent="done"
            >
          </label>
          <label class="shirt-field">
            <span class="label small">{{ ru.club.number }}</span>
            <input
              v-model="shirtNumber"
              class="field shirt-input number"
              type="text"
              inputmode="numeric"
              maxlength="2"
              autocomplete="off"
              :placeholder="ru.club.numberPlaceholder"
              :aria-invalid="shirtNumberError !== null"
              aria-describedby="club-shirt-hint club-shirt-error"
              @keydown.enter.prevent="done"
            >
          </label>
        </div>
        <p
          id="club-shirt-hint"
          class="small-hint"
        >
          {{ ru.club.shirtHint }}
        </p>
        <p
          id="club-shirt-error"
          class="error"
          aria-live="polite"
        >
          {{ shirtError ?? '' }}
        </p>
      </aside>
    </div>

    <div class="actions">
      <KeyButton
        primary
        @click="done"
      >
        {{ ru.club.done }}
      </KeyButton>
    </div>
  </section>
</template>

<style scoped>
/* Вечерний облик главной: тёмно-синие панели, золото — выбранное и рамки, кремовый текст. */
.club {
  max-width: 1100px;
  margin: 0 auto;
  color: #fff6e0;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
  gap: var(--space-4);
  align-items: start;
}

.panel {
  background: linear-gradient(160deg, #3a3f86, #1f2152);
  border-radius: 18px;
  padding: var(--space-3) var(--space-4) var(--space-4);
  box-shadow:
    0 0 0 3px #f4c24a,
    0 10px 24px rgb(0 0 0 / 0.35);
}

.head {
  margin-bottom: var(--space-3);
}

h1 {
  margin: 0;
  font-size: 1.6rem;
  color: #fff6e0;
}

.hint {
  margin: 0;
  color: rgb(255 246 224 / 0.8);
  font-size: 0.95rem;
}

h2 {
  margin: var(--space-2) 0 var(--space-2);
  font-size: 1.1rem;
  color: #fff6e0;
}

.label {
  display: block;
  font-weight: 800;
  font-size: 1.1rem;
  margin-bottom: var(--space-2);
}

.label.small {
  font-size: 0.95rem;
  margin-bottom: var(--space-1);
}

.name-row {
  display: flex;
  gap: var(--space-2);
}

.field {
  box-sizing: border-box;
  min-width: 0;
  border: 3px solid #f4c24a;
  border-radius: 12px;
  background: #fff6e0;
  color: #1f2152;
  font: inherit;
  font-weight: 800;
}

.field::placeholder {
  color: rgb(31 33 82 / 0.45);
}

.field[aria-invalid='true'] {
  border-color: #ff8a7a;
}

.name-input {
  flex: 1;
  min-height: 56px;
  padding: 8px 14px;
  font-size: 1.5rem;
}

/* «Придумать» — вторая по важности кнопка: золотая рамка, без заливки. */
.suggest {
  flex: none;
  min-height: 56px;
  padding: 0 var(--space-4);
  border: 3px solid #f4c24a;
  border-radius: 12px;
  background: rgb(244 194 74 / 0.15);
  color: #fff6e0;
  font: inherit;
  font-size: 1.05rem;
  font-weight: 800;
  cursor: pointer;
}

.suggest:hover {
  background: rgb(244 194 74 / 0.3);
}

.suggest:active {
  transform: translateY(2px);
}

.small-hint {
  margin: var(--space-2) 0 0;
  font-size: 0.9rem;
  color: rgb(255 246 224 / 0.8);
}

/* Строка ошибки держит высоту, чтобы всё ниже не прыгало. */
.error {
  min-height: 1.4em;
  margin: var(--space-1) 0 0;
  font-weight: 700;
  color: #ffb4a8;
}

.variants {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(44px, 1fr));
  gap: var(--space-2);
}

.variant {
  padding: 4px;
  border: 3px solid transparent;
  border-radius: 12px;
  background: rgb(0 0 0 / 0.25);
  cursor: pointer;
}

.variant.chosen {
  border-color: #f4c24a;
}

.variant:focus-visible,
.suggest:focus-visible,
.field:focus-visible {
  outline: 4px solid #fff6e0;
  outline-offset: 2px;
}

.preview {
  text-align: center;
}

.preview h2 {
  margin-top: 0;
}

/* Спереди и сзади рядом; по высоте окна тоже — на ноутбуке 1366×680 всё должно влезать. */
.shirts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
  max-width: min(300px, 44vh / var(--ui-scale));
  margin: 0 auto;
}

figure {
  margin: 0;
}

figcaption {
  font-size: 0.85rem;
  color: rgb(255 246 224 / 0.75);
}

.preview-name {
  display: block;
  margin-top: var(--space-1);
  font-weight: 800;
  font-size: 1.4rem;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.shirt-fields {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
  text-align: left;
}

.shirt-field.grow {
  flex: 1;
  min-width: 0;
}

.shirt-input {
  width: 100%;
  min-height: 48px;
  padding: 6px 10px;
  font-size: 1.15rem;
}

.shirt-input.number {
  width: 4.5em;
  text-align: center;
}

.preview .small-hint,
.preview .error {
  text-align: left;
}

/* «Готово» прилипает к низу окна: ребёнок не должен искать её прокруткой. */
.actions {
  position: sticky;
  bottom: var(--space-2);
  margin-top: var(--space-3);
  text-align: center;
  pointer-events: none;
}

.actions > * {
  pointer-events: auto;
}

@media (width <= 760px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .variants {
    grid-template-columns: repeat(4, minmax(44px, 1fr));
  }
}
</style>
