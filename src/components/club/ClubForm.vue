<script setup lang="ts">
// Форма клуба (спека 019, design §3, К8): название («Придумать»), 9 палитр, форма вживую, город.
// Один компонент для создания (по шагам: part="club", затем part="city") и правки (part="all").
// Ничего не пишет и экранов не знает: меняет `modelValue`, на «Дальше»/«Готово» отдаёт проверенный черновик
// событием `submit`, на Esc — `back`. Запись и переходы — на стороне экрана.
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { clubData } from '../../app/kits';
import { checkClubName } from '../../engine/club/names';
import { clubKit, sameColors } from '../../engine/club/kit';
import { checkCity, suggestClubName, EDIT_CHIPS, type ClubDraft } from '../../engine/club/create';
import type { Kit } from '../../engine/kit';
import { ru } from '../../i18n/ru';
import KeyButton from '../KeyButton.vue';
import CityField from './CityField.vue';
import ClubPreview from './ClubPreview.vue';
import KitPicker from './KitPicker.vue';

const props = withDefaults(
  defineProps<{
    modelValue: ClubDraft;
    /** club — название и форма; city — город; all — всё сразу (правка). */
    part?: 'club' | 'city' | 'all';
    /** Подпись главной кнопки; по умолчанию «Дальше» (club) или «Готово». */
    submitLabel?: string;
  }>(),
  { part: 'all', submitLabel: '' },
);
const emit = defineEmits<{ 'update:modelValue': [value: ClubDraft]; submit: [value: ClubDraft]; back: [] }>();

const showClub = computed(() => props.part !== 'city');
const showCity = computed(() => props.part !== 'club');

// Форма клуба из старого сохранения может быть не из нынешних палитр: она идёт последним вариантом,
// чтобы «Готово» молча не заменило форму ребёнка. На смене шага образец берётся заново — по выбранному.
const startKit = ref(props.modelValue.kit);
const palettes = computed(() =>
  clubData.palettes.some((p) => sameColors(p, startKit.value)) ? clubData.palettes : [...clubData.palettes, startKit.value],
);

const nameTouched = ref(false);
const cityTouched = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);
const cityField = ref<{ focus: () => void } | null>(null);
let suggestions = 0;

const nameCheck = computed(() => checkClubName(props.modelValue.name));
const cityCheck = computed(() => checkCity(props.modelValue.city));

/** Пустое поле и «слишком коротко» — только после попытки «Дальше» или ухода из поля. */
const nameError = computed(() => {
  const c = nameCheck.value;
  if (c.ok) return null;
  if (props.modelValue.name.trim() === '') return nameTouched.value ? ru.clubForm.nameErrors.empty : null;
  if (c.error === 'short' && !nameTouched.value) return null;
  return ru.clubForm.nameErrors[c.error];
});

/** Город: ошибка — после попытки; «латиница» показывает само поле, пока набирают. */
const cityError = computed(() => {
  const c = cityCheck.value;
  return c.ok || !cityTouched.value ? null : ru.clubForm.cityErrors[c.error];
});

const previewKit = computed<Kit>(() =>
  clubKit({ name: nameCheck.value.ok ? nameCheck.value.name : ru.clubForm.pickName, kit: props.modelValue.kit }),
);
const previewName = computed(() => props.modelValue.name.trim() || ru.clubForm.pickName);
const previewCity = computed(() => (cityCheck.value.ok ? cityCheck.value.city : ''));

const label = computed(() => props.submitLabel || (props.part === 'club' ? ru.clubForm.next : ru.clubForm.done));

const update = (patch: Partial<ClubDraft>): void => emit('update:modelValue', { ...props.modelValue, ...patch });

/** «Придумать»: новое название в поле; фокус остаётся на кнопке — можно жать ещё. */
function suggest(): void {
  suggestions += 1;
  // Зерно от часов страницы и счётчика: два нажатия в одну миллисекунду дают разные названия.
  const seed = (Date.now() + suggestions * 7919) % 2147483647;
  update({ name: suggestClubName(clubData, props.modelValue.name, seed) });
  nameTouched.value = false;
}

function submit(): void {
  const name = nameCheck.value;
  const city = cityCheck.value;
  if (showClub.value && !name.ok) {
    nameTouched.value = true;
    nameInput.value?.focus();
    return;
  }
  if (showCity.value && !city.ok) {
    cityTouched.value = true;
    cityField.value?.focus();
    return;
  }
  emit('submit', {
    name: name.ok ? name.name : props.modelValue.name,
    kit: props.modelValue.kit,
    city: city.ok ? city.city : props.modelValue.city,
  });
}

/** Фокус в поле нового шага; предложенное название выделено целиком — ребёнок печатает своё поверх, а не дописывает (Т15). */
const focusStep = (): void =>
  void nextTick(() => {
    if (showClub.value) {
      nameInput.value?.focus();
      nameInput.value?.select();
    } else cityField.value?.focus();
  });

onMounted(focusStep);
// Экран переключает шаги тем же компонентом: фокус — в поле нового шага, образец формы — по выбранной.
watch(
  () => props.part,
  () => {
    startKit.value = props.modelValue.kit;
    focusStep();
  },
);
</script>

<template>
  <form
    class="club-form"
    novalidate
    @submit.prevent="submit"
    @keydown.esc.prevent="emit('back')"
  >
    <div class="layout">
      <div class="panel main">
        <template v-if="showClub">
          <label
            for="club-form-name"
            class="label"
          >{{ ru.clubForm.nameLabel }}</label>
          <div class="name-row">
            <input
              id="club-form-name"
              ref="nameInput"
              class="field name-input"
              type="text"
              maxlength="30"
              autocomplete="off"
              spellcheck="false"
              :value="modelValue.name"
              :placeholder="ru.clubForm.namePlaceholder"
              :aria-invalid="nameError !== null"
              aria-describedby="club-form-name-hint club-form-name-error"
              @input="update({ name: ($event.target as HTMLInputElement).value })"
              @blur="nameTouched = true"
              @keydown.enter.prevent="submit"
            >
            <button
              type="button"
              class="suggest"
              @click="suggest"
            >
              {{ ru.clubForm.suggest }}
            </button>
          </div>
          <p
            id="club-form-name-hint"
            class="small-hint"
          >
            {{ ru.clubForm.nameHint }}
          </p>
          <p
            id="club-form-name-error"
            class="error"
            aria-live="polite"
          >
            {{ nameError ?? '' }}
          </p>

          <h2 id="club-form-colors">
            {{ ru.clubForm.colors }}
          </h2>
          <KitPicker
            :model-value="modelValue.kit"
            :palettes="palettes"
            @update:model-value="(kit) => update({ kit })"
            @submit="submit"
          />
        </template>

        <CityField
          v-if="showCity"
          ref="cityField"
          uid="club"
          :model-value="modelValue.city"
          :cities="clubData.cities"
          :error="cityError"
          :chips="part === 'all' ? EDIT_CHIPS : undefined"
          @update:model-value="(v: string) => update({ city: v })"
          @submit="submit"
        />
      </div>

      <ClubPreview
        :kit="previewKit"
        :name="previewName"
        :city="previewCity"
      />
    </div>

    <div class="actions">
      <KeyButton
        primary
        @click="submit"
      >
        {{ label }}
      </KeyButton>
    </div>
  </form>
</template>

<style scoped>
.club-form {
  max-width: 1100px;
  margin: 0 auto;
  color: var(--text);
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 300px);
  gap: var(--space-4);
  align-items: start;
}

h2 {
  margin: var(--space-2) 0;
  font-size: 1.1rem;
}

.label {
  display: block;
  font-weight: 800;
  font-size: 1.1rem;
  margin-bottom: var(--space-2);
}

.name-row {
  display: flex;
  gap: var(--space-2);
}

.field {
  box-sizing: border-box;
  min-width: 0;
  border: 3px solid var(--field-border);
  border-radius: 12px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-weight: 800;
}

.field::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

.field:focus-visible {
  border-color: var(--accent);
  outline: 4px solid var(--text);
  outline-offset: 2px;
}

.field[aria-invalid='true'] {
  border-color: var(--error);
}

.name-input {
  flex: 1;
  min-height: 56px;
  padding: 8px 14px;
  font-size: 1.5rem;
}

/* «Придумать» — вторая по важности кнопка: рамка цвета акцента, без заливки. */
.suggest {
  flex: none;
  min-height: 56px;
  padding: 0 var(--space-4);
  border: 3px solid var(--accent);
  border-radius: 12px;
  background: var(--accent-soft);
  color: var(--text);
  font-size: 1.05rem;
  font-weight: 800;
  cursor: pointer;
}

.suggest:hover {
  background: rgb(244 194 74 / 0.35);
}

.suggest:active {
  transform: translateY(2px);
}

.small-hint {
  margin: var(--space-2) 0 0;
  font-size: 0.9rem;
  color: var(--text-muted);
}

/* Строка ошибки держит высоту, чтобы всё ниже не прыгало. */
.error {
  min-height: 1.4em;
  margin: var(--space-1) 0 0;
  font-weight: 700;
  color: var(--error);
}

.suggest:focus-visible {
  outline: 4px solid var(--text);
  outline-offset: 2px;
}

/* Кнопка прилипает к низу окна: ребёнок не должен искать её прокруткой. */
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

/* «Город клуба» не прижат к ряду палитр (они вместе только в правке). */
.variants + .city {
  margin-top: var(--space-4);
}

@media (width <= 760px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
