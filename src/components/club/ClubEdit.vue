<script setup lang="ts">
// Правка клуба поверх карты (спека 019-Т8, Р16): `ClubForm` целиком (название, цвета, город) в окне. «Готово» пишет
// три поля одной записью (`editClubNow`) и закрывает окно; Esc закрывает без записи. Черновик — свой, лежащий клуб
// не трогается до «Готово». Запись не двоится: второй «Готово» подряд (двойной Enter) ничего не делает.
import { ref } from 'vue';
import { clubRef, editClubNow } from '../../app/club/club';
import type { ClubDraft } from '../../engine/club/create';
import { ru } from '../../i18n/ru';
import MapDialog from '../map/MapDialog.vue';
import ClubForm from './ClubForm.vue';

const emit = defineEmits<{ close: [] }>();

const { name, kit, city } = clubRef.value;
const draft = ref<ClubDraft>({ name, kit, city });
let saved = false;

function submit(d: ClubDraft): void {
  if (saved) return;
  saved = true;
  editClubNow(d);
  emit('close');
}
</script>

<template>
  <MapDialog
    labelledby="club-edit-title"
    wide
    below-tabs
    :backdrop="false"
    @close="emit('close')"
  >
    <template #default="{ close }">
      <div class="head">
        <h2 id="club-edit-title">
          {{ ru.map.edit.title }}
        </h2>
        <button
          type="button"
          class="close"
          @click="close"
        >
          {{ ru.map.edit.close }}
        </button>
      </div>
      <ClubForm
        v-model="draft"
        part="all"
        class="edit-form"
        @submit="submit"
      />
    </template>
  </MapDialog>
</template>

<style scoped>
.head {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-1);
}

h2 {
  margin: 0;
  font-size: 1.4rem;
}

/* Видимый выход без клавиатуры (Esc закрывает так же): правка без записи, как Esc. */
.close {
  min-height: 44px;
  padding: 0 var(--space-4);
  border: 2px solid var(--field-border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.close:focus-visible {
  outline: 4px solid var(--text);
  outline-offset: 2px;
}

/*
 * Тесная раскладка (019-Т8д): окно не выше экрана, а форма в нём — без прокрутки на 1024×640. Слева название, палитры
 * в один ряд и город, справа форма вживую и «Готово» под ней. Шаги первого запуска (/start) этого не касаются.
 */
.edit-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: var(--space-3) var(--space-4);
  align-items: start;
  max-width: none;
}

.edit-form :deep(.layout) {
  display: contents;
}

.edit-form :deep(.main) {
  grid-column: 1;
  grid-row: 1 / span 2;
  padding: var(--space-2) var(--space-4);
}

.edit-form :deep(.preview) {
  grid-column: 2;
  grid-row: 1;
  padding: var(--space-3);
}

.edit-form :deep(.preview .shirt) {
  max-width: min(130px, 28vh / var(--ui-scale));
}

.edit-form :deep(.preview-name) {
  font-size: 1.2rem;
}

.edit-form :deep(.actions) {
  position: static;
  grid-column: 2;
  grid-row: 2;
  align-self: end;
  margin-top: 0;
}

.edit-form :deep(.actions .key-btn) {
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.edit-form :deep(.variants) {
  /* Палитра — строго в один ряд: плитки сжимаются, а не переносятся (перенос давал +68 px, браузер 08.11). */
  grid-template-columns: none;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 60px);
  gap: 6px;
  justify-content: start;
}

.edit-form :deep(.options) {
  min-height: 48px;
}

.edit-form :deep(.option) {
  padding: 4px 12px;
  font-size: 1rem;
}

.edit-form :deep(.name-input),
.edit-form :deep(.suggest) {
  min-height: 48px;
}

.edit-form :deep(.name-input) {
  padding-block: 4px;
  font-size: 1.25rem;
}
</style>
