<script setup lang="ts">
/**
 * Карточка тренажёра перед новым видом (067 Т16, Э3.18, ТЗ-6.9, Р80): тренажёр вида, если он у вида есть и не взят хотя бы на
 * бронзу. «Тренажёр» ведёт в игру вида, «Пропустить» — тур из прежних видов, новый вид ждёт.
 * Только показ: что делают кнопки — решает экран тура.
 */
import { fill } from '../../app/home/texts';
import KeyButton from '../../components/kit/KeyButton.vue';
import { trainerGame } from '../../engine/school/order';
import { ru } from '../../i18n/ru';

const props = defineProps<{ kind: string; n: number }>();
defineEmits<{ start: []; skip: [] }>();
const t = ru.school.trainer;
const game = ru.learn.games[(trainerGame(props.kind) ?? '') as keyof typeof ru.learn.games]?.name ?? '';
</script>

<template>
  <div class="card-trainer">
    <div class="zad">
      {{ t.title }} <small>{{ t.sub }}</small>
    </div>
    <div class="kind">
      {{ fill(t.hint, { kind: ru.school.kinds[kind] ?? '' }) }}
    </div>
    <p class="q">
      {{ fill(t.lead, { game }) }}
    </p>
    <p class="note">
      {{ fill(t.note, { n: String(n) }) }}
    </p>
    <div class="btns">
      <KeyButton
        primary
        data-act="start"
        :sub="ru.kit.enter"
        @click="$emit('start')"
      >
        {{ t.title }}
      </KeyButton>
      <button
        type="button"
        class="skip"
        data-act="skip"
        @click="$emit('skip')"
      >
        {{ ru.kit.skip }} — {{ t.skipTail }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.zad { font-size: 13px; font-weight: 800; text-transform: uppercase; }
.zad small { margin-left: 8px; font-weight: 600; color: #6b6b76; text-transform: none; }
.kind { color: #6b6b76; font-size: 14px; }
.q { font-size: 18px; margin: 8px 0; }
.note { margin: 12px 0 0; padding: 8px 12px; border-radius: 8px; background: #f1f1f5; color: #6b6b76; font-size: 14px; }
.btns { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 18px; }
/* «Пропустить» — тихая ссылка справа от главной кнопки «Тренажёр» (Э3.18) */
.skip { border: 0; background: none; padding: 4px 2px; font: inherit; font-weight: 700; color: var(--paper-focus, #1d4ed8); text-decoration: underline; cursor: pointer; }
.skip:focus-visible { outline: 3px solid var(--paper-focus); outline-offset: 2px; }
</style>
