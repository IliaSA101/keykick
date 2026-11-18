<script setup lang="ts">
/** Окно сбоя (лист Э6.57–62): шаг 1 — «Ой, что-то сломалось», шаг 2 — «Позови взрослого» с файлом ошибки. Отдельное приложение Vue (014-Р8). */
import KeyButton from '../../components/kit/KeyButton.vue';
import KitModal from '../../components/panel/KitModal.vue';
import TelegramLine from '../../components/panel/TelegramLine.vue';
import { ru } from '../../i18n/ru';

defineProps<{ step: 1 | 2; savedAs?: string | null }>();
const emit = defineEmits<{ home: []; saveFile: [] }>();
</script>

<template>
  <div class="crash-layer stage">
    <!-- Esc закрывает только шаг 2: на шаге 1 одна кнопка, Enter (кадр Э6.57) -->
    <KitModal
      :title="step === 1 ? ru.system.crash.title : ru.system.again.title"
      :lead="step === 1 ? ru.system.crash.lead : ru.system.again.lead"
      :width="600"
      :top="190"
      role="alertdialog"
      dim-color="rgb(10 9 32 / 0.8)"
      :esc-close="step === 2"
      @close="emit('home')"
    >
      <template v-if="step === 1">
        <KeyButton
          primary
          :sub="ru.system.enter"
          @click="emit('home')"
        >
          {{ ru.system.crash.home }}
        </KeyButton>
      </template>
      <template v-else-if="savedAs">
        <p class="note">
          <b>✓</b> {{ ru.system.again.saved }}
        </p>
        <p class="note">
          {{ savedAs }}
        </p>
        <TelegramLine
          :before="ru.system.again.sendBefore"
          :after="ru.system.again.sendAfter"
        />
        <KeyButton
          primary
          :sub="ru.system.enter"
          @click="emit('home')"
        >
          {{ ru.system.again.home }}
        </KeyButton>
      </template>
      <template v-else>
        <TelegramLine
          :before="ru.system.again.sendBefore"
          :after="ru.system.again.sendAfter"
        />
        <div class="btns">
          <KeyButton
            primary
            :sub="ru.system.enter"
            @click="emit('saveFile')"
          >
            {{ ru.system.again.saveFile }}
          </KeyButton>
          <KeyButton
            quiet
            md
            :sub="ru.system.esc"
            @click="emit('home')"
          >
            {{ ru.system.again.home }}
          </KeyButton>
        </div>
      </template>
    </KitModal>
  </div>
</template>

<style scoped>
.crash-layer {
  position: fixed;
  inset: 0;
  z-index: 1000;
  width: auto;
  height: auto;
  background: transparent;
}
</style>
