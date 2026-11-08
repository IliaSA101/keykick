<script setup lang="ts">
// Поле города с подсказками (спека 019, design §2.1, Р13; 019-Р40): до 8 чипов, стрелки выбирают, Enter подставляет.
// Запрос без русских букв ищется ещё и переводом раскладки («ndthm» → «Тверь»), под полем — подсказка про раскладку.
// Компонент только вводит: проверку, ошибку и «Готово» держит форма (ClubForm), здесь — событие `submit`.
import { computed, nextTick, ref } from 'vue';
import { keymap } from '../../app/keymap';
import { CITY_MAX, cityChips, exactCity, sameCity } from '../../engine/club/create';
import { ru } from '../../i18n/ru';

const props = defineProps<{
  modelValue: string;
  cities: readonly string[];
  /** Текст ошибки под полем; null — нет. */
  error: string | null;
  /** Уникальная часть id (на странице может быть одно поле, но id не должен быть общим). */
  uid?: string;
  /** Сколько чипов показывать; в тесной правке клуба — 5, на первом запуске — 8 (019-Р40). */
  chips?: number | undefined;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string]; submit: [] }>();

const id = `city-${props.uid ?? 'field'}`;
const input = ref<HTMLInputElement | null>(null);
/** Подсвеченная подсказка; -1 — нет (пустой запрос: Enter на пустом не выбирает «первый попавшийся»). */
const active = ref(-1);

const list = computed(() => cityChips(props.cities, props.modelValue, keymap, props.chips));
const current = computed(() => (active.value >= 0 && active.value < list.value.length ? active.value : -1));

// Русские буквы — кодами диапазонов (русских слов вне i18n в коде нет, страж guards.test).
const HAS_CYRILLIC = /[\u0410-\u044f\u0401\u0451]/;
const HAS_LATIN = /[a-zA-Z]/;
const wrongLayout = computed(() => HAS_LATIN.test(props.modelValue) && !HAS_CYRILLIC.test(props.modelValue));

/** Строка состояния под полем: ошибка важнее подсказки про раскладку, она важнее общей подсказки. */
const status = computed(() => {
  if (props.error !== null) return { text: props.error, kind: 'error' };
  if (wrongLayout.value) return { text: ru.clubForm.cityErrors.layout, kind: 'warn' };
  return { text: ru.clubForm.cityHint, kind: 'hint' };
});

function onInput(e: Event): void {
  const value = (e.target as HTMLInputElement).value;
  emit('update:modelValue', value);
  // Набирают — первая подсказка готова к Enter; поле опустело — подсвечивать нечего.
  active.value = value.trim() === '' ? -1 : 0;
}

function choose(city: string): void {
  emit('update:modelValue', city);
  active.value = 0;
  input.value?.focus();
}

function move(step: 1 | -1): void {
  const n = list.value.length;
  if (n === 0) return;
  active.value = current.value < 0 ? (step === 1 ? 0 : n - 1) : (current.value + step + n) % n;
}

/**
 * Enter: подсвеченный город, которого ещё нет в поле, подставляется; иначе — «Готово». Набранное точно как город списка
 * (Ё = Е, регистр не важен) — сразу «Готово», без второго Enter (Т15); если оно отличается от списка буквами («орел»),
 * сначала в поле встаёт город списка, и «Готово» идёт следом, когда форма уже его увидела.
 */
function onEnter(): void {
  const hit = current.value >= 0 ? list.value[current.value] : undefined;
  if (hit !== undefined && !sameCity(props.modelValue, hit)) {
    choose(hit);
    return;
  }
  const exact = exactCity(props.cities, props.modelValue);
  if (exact !== null && exact !== props.modelValue) {
    emit('update:modelValue', exact);
    void nextTick(() => emit('submit'));
    return;
  }
  emit('submit');
}

/** Esc при подсвеченной подсказке снимает подсветку и дальше не идёт; второй Esc уходит форме как «назад». */
function onEsc(e: KeyboardEvent): void {
  if (current.value < 0) return;
  e.stopPropagation();
  e.preventDefault();
  active.value = -1;
}

defineExpose({ focus: (): void => input.value?.focus() });
</script>

<template>
  <div class="city">
    <label
      :for="id"
      class="label"
    >{{ ru.clubForm.cityLabel }}</label>
    <input
      :id="id"
      ref="input"
      class="field"
      type="text"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="list.length > 0"
      :aria-controls="`${id}-list`"
      :aria-activedescendant="current >= 0 ? `${id}-opt-${current}` : undefined"
      :aria-describedby="`${id}-status`"
      :aria-invalid="error !== null"
      :value="modelValue"
      :maxlength="CITY_MAX + 8"
      autocomplete="off"
      spellcheck="false"
      :placeholder="ru.clubForm.cityPlaceholder"
      @input="onInput"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="onEnter"
      @keydown.esc="onEsc"
    >
    <p
      :id="`${id}-status`"
      class="status"
      :class="status.kind"
      aria-live="polite"
    >
      {{ status.text }}
    </p>
    <ul
      :id="`${id}-list`"
      class="options"
      role="listbox"
      :aria-label="ru.clubForm.cityList"
    >
      <li
        v-for="(city, i) in list"
        :id="`${id}-opt-${i}`"
        :key="city"
        class="option"
        :class="{ on: i === current }"
        role="option"
        :aria-selected="i === current"
        @mousedown.prevent
        @click="choose(city)"
      >
        {{ city }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.label {
  display: block;
  font-weight: 800;
  font-size: 1.1rem;
  margin-bottom: var(--space-2);
}

.field {
  box-sizing: border-box;
  width: 100%;
  min-height: 56px;
  padding: 8px 14px;
  border: 3px solid var(--field-border);
  border-radius: 12px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 1.5rem;
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

/* Строка состояния держит высоту, чтобы список ниже не прыгал. */
.status {
  min-height: 1.4em;
  margin: var(--space-1) 0 var(--space-2);
  font-size: 0.95rem;
  color: var(--text-muted);
}

.status.error,
.status.warn {
  font-weight: 700;
  color: var(--accent);
}

.status.error {
  color: var(--error);
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
  /* Пять названий в один-два ряда: высота не прыгает, пока их 0–5. */
  min-height: 96px;
  align-content: flex-start;
}

.option {
  padding: 8px 16px;
  border: 3px solid var(--field-border);
  border-radius: 12px;
  background: var(--surface);
  font-weight: 800;
  font-size: 1.1rem;
  cursor: pointer;
  user-select: none;
}

.option:hover {
  border-color: var(--accent);
}

.option.on {
  border-color: var(--accent);
  background: var(--accent-soft);
}
</style>
