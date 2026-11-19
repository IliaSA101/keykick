<script setup lang="ts">
/**
 * Праздник эмблемы (067 Т16, Э3.24, ТЗ-6.7): десятая часть собрана — один раз, на итоге тура, когда `finishTour` дал `emblemDone`
 * (повтор части не даёт, Ш-З3, — праздника за него нет). Щит целиком на светлой плашке, герб уходит на вывеску и формы.
 * Enter — «Посмотреть на Доме», Esc — закрыть (журнал). Свет праздника белый: золота на синем нет (ТАБУ).
 */
import KeyButton from '../../components/kit/KeyButton.vue';
import KitModal from '../../components/panel/KitModal.vue';
import CrestShield from '../../components/school/CrestShield.vue';
import { KINDS } from '../../engine/school/order';
import { ru } from '../../i18n/ru';

defineEmits<{ home: []; close: [] }>();
const t = ru.school.fest;
const all = KINDS.map(() => true);
</script>

<template>
  <KitModal
    :title="t.title"
    :lead="t.lead"
    :width="540"
    :top="48"
    :enter-delay="300"
    @close="$emit('close')"
  >
    <div class="plate">
      <CrestShield
        :on="all"
        :height="210"
      />
    </div>
    <template #buttons>
      <KeyButton
        primary
        :sub="ru.kit.enter"
        @click="$emit('home')"
      >
        {{ t.home }}
      </KeyButton>
    </template>
  </KitModal>
</template>

<style scoped>
.plate { width: 280px; box-sizing: border-box; margin: 6px auto; padding: 14px 0 10px; display: flex; justify-content: center; border-radius: 10px; background: repeating-conic-gradient(from 0deg at 50% 55%, #ffffff 0 7.5deg, #f4f1e6 7.5deg 15deg); }
</style>
