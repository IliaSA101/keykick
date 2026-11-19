<script setup lang="ts">
/**
 * Окно «Твой клуб» (лист Э2К.36/37): форма спереди и сзади, название с «Придумать», город с подсказками, имя и номер на спине,
 * 9 расцветок плитками (выбранная — белая кайма, не золотая: ТАБУ). Enter — «Сохранить», Esc — «Отмена».
 * Черновик (`draft`) правится на месте: тексты подрезает движок при сохранении (`clubFromDraft`).
 */
import { computed } from 'vue';
import KeyButton from '../kit/KeyButton.vue';
import KitChip from '../kit/KitChip.vue';
import ClubRow from './ClubRow.vue';
import ClubShirts from './ClubShirts.vue';
import ShirtView from './ShirtView.vue';
import KitModal from '../panel/KitModal.vue';
import { ENTER_DELAY } from '../panel/focusCycle';
import { BACK_NAME_MAX, CITY_MAX, NAME_MAX } from '../../engine/club/section';
import { PALETTES, cityHints, draftKit, draftProblems, numberDigits, numberOf, suggestName, type Draft } from '../../engine/club/start';
import { ru } from '../../i18n/ru';
import { CLUB_WINDOW } from './places';

const draft = defineModel<Draft>('draft', { required: true });
const emit = defineEmits<{ save: []; cancel: [] }>();

const kit = computed(() => draftKit(draft.value));
const back = computed(() => ({ name: draft.value.backName, number: draft.value.backNumber }));
const hints = computed(() => cityHints(draft.value.city));
const problems = computed(() => draftProblems(draft.value));

function save(): void {
  if (problems.value.length === 0) emit('save');
}
/** Номер: только цифры — набранное в поле тут же очищается («a7» → «7»), на форме — то же число. */
function number(e: Event): void {
  const input = e.target as HTMLInputElement;
  input.value = numberDigits(input.value);
  draft.value.backNumber = numberOf(input.value);
}
</script>

<template>
  <KitModal
    :title="ru.start.club.title"
    :width="CLUB_WINDOW.width"
    :top="CLUB_WINDOW.top"
    :enter-delay="ENTER_DELAY"
    left
    @close="emit('cancel')"
  >
    <div
      class="edit"
      @keydown.enter="save"
    >
      <ClubShirts
        :kit="kit"
        :back="back"
        :label="ru.start.club.title"
      />
      <div class="fields">
        <ClubRow :label="ru.start.club.name">
          <input
            v-model="draft.name"
            :maxlength="NAME_MAX"
            :aria-invalid="problems.includes('name')"
            autocomplete="off"
          >
          <KitChip
            sm
            @click="draft.name = suggestName(Math.random)"
          >
            {{ ru.start.club.think }}
          </KitChip>
        </ClubRow>
        <ClubRow :label="ru.start.club.city">
          <input
            v-model="draft.city"
            :maxlength="CITY_MAX"
            list="start-cities"
            autocomplete="off"
          >
          <datalist id="start-cities">
            <option
              v-for="c in hints"
              :key="c"
              :value="c"
            />
          </datalist>
        </ClubRow>
        <ClubRow :label="ru.start.club.backName">
          <input
            v-model="draft.backName"
            :maxlength="BACK_NAME_MAX"
            autocomplete="off"
          >
        </ClubRow>
        <ClubRow :label="ru.start.club.number">
          <input
            :value="draft.backNumber || ''"
            inputmode="numeric"
            pattern="[0-9]*"
            autocomplete="off"
            @input="number"
          >
        </ClubRow>
        <p
          v-if="problems.includes('name')"
          class="note bad"
          role="alert"
        >
          {{ ru.start.club.needName }}
        </p>
        <p class="plab">
          {{ ru.start.club.palette }}
        </p>
        <div
          class="tiles"
          role="radiogroup"
          :aria-label="ru.start.club.palette"
        >
          <button
            v-for="(p, i) in PALETTES"
            :key="i"
            type="button"
            class="tile"
            :class="{ sel: i === draft.palette }"
            role="radio"
            :aria-checked="i === draft.palette"
            :aria-label="`${ru.start.club.paletteItem} ${i + 1}`"
            @click="draft.palette = i"
          >
            <span class="mini"><ShirtView :kit="p" /></span>
          </button>
        </div>
        <p class="warn">
          {{ ru.start.club.repaint }}
        </p>
      </div>
    </div>
    <template #buttons>
      <KeyButton
        primary
        :sub="ru.kit.enter"
        @click="save"
      >
        {{ ru.start.club.save }}
      </KeyButton>
      <span />
      <KeyButton
        quiet
        :sub="ru.kit.esc"
        @click="emit('cancel')"
      >
        {{ ru.start.club.cancel }}
      </KeyButton>
    </template>
  </KitModal>
</template>

<style scoped>
/* числа — единицы макета из генераторов Э2К.36 (e2k-club.mjs, collection-e.css и collection-e-club.css); множителя нет */
.edit {
  display: flex;
  gap: 18px;
  text-align: left;
}
.fields {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.plab {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-muted);
}
.tiles {
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr)); /* без minmax(0) плитки раздвигались формой 46 и девятая вылезала */
  gap: 5px;
  padding: 7px;
  border-radius: 12px;
  background: #11122c;
}
.tile {
  display: flex;
  justify-content: center;
  min-width: 0;
  padding: 5px 0 6px;
  border: 1.5px solid #2b2f72;
  border-radius: 10px;
  background: #1a1c45;
  cursor: pointer;
}
.mini {
  display: block;
  flex: 0 0 46px; /* форма 46 в плитке шириной ≈44: выступает поровну с обеих сторон, как в кадре */
  width: 46px;
}
.tile.sel,
.tile:focus-visible {
  outline: 3px solid var(--text); /* выбранная — белая кайма (Э2К.36), не золотая: ТАБУ */
  outline-offset: 1px;
}
.warn {
  margin: 0;
  font-size: 12px;
  line-height: 1.2;
  color: var(--text-muted);
}
.note.bad,
.bad {
  margin: 0;
  color: var(--error);
}
</style>
