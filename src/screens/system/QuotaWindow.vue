<script setup lang="ts">
/** «Позови взрослого» при отказе записи (квота, Э6.59–62): успехи в памяти вкладки; «Сохранить клуб в файл» берёт их оттуда, после — «Файл сохранён». */
import KeyButton from '../../components/kit/KeyButton.vue';
import KitModal from '../../components/panel/KitModal.vue';
import TelegramLine from '../../components/panel/TelegramLine.vue';
import { ru } from '../../i18n/ru';

defineProps<{ savedAs?: string | null; failed?: boolean }>();
const emit = defineEmits<{ save: []; close: [] }>();
</script>

<template>
  <KitModal
    :title="ru.system.again.title"
    :lead="ru.system.quota.lead"
    :width="600"
    :top="190"
    role="alertdialog"
    dim-color="rgb(10 9 32 / 0.8)"
    @close="emit('close')"
  >
    <template v-if="savedAs">
      <p class="note">
        <b>✓</b> {{ ru.system.again.saved }}
      </p>
      <p class="note">
        {{ savedAs }}
      </p>
    </template>
    <p
      v-if="failed"
      class="note"
      role="status"
    >
      {{ ru.parent.file.saveFail }}
    </p>
    <TelegramLine
      :before="ru.system.again.sendBefore"
      :after="ru.system.again.sendAfter"
    />
    <div class="btns">
      <KeyButton
        v-if="!savedAs"
        primary
        :sub="ru.system.enter"
        @click="emit('save')"
      >
        {{ ru.parent.file.save }}
      </KeyButton>
      <KeyButton
        :primary="!!savedAs"
        :quiet="!savedAs"
        md
        :sub="savedAs ? ru.system.enter : ru.system.esc"
        @click="emit('close')"
      >
        {{ ru.kit.close }}
      </KeyButton>
    </div>
  </KitModal>
</template>
