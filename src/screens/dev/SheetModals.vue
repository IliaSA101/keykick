<script setup lang="ts">
/** Раздел «окна»: пауза и список в KitModal — eb-modals (063 К7). Слот — кнопка «Сломать» (её подключает только `KitSheet.vue`, страж С5). */
import { ref } from 'vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitModal from '../../components/panel/KitModal.vue';
import ShellHeader from '../../components/shell/ShellHeader.vue';
import { ru } from '../../i18n/ru';

const t = ru.kit.sheet;
const openModal = ref<'ask' | 'list' | null>(null);
</script>

<template>
  <div
    class="eb-row"
    style="top: 0"
  >
    <ShellHeader page="home" />
  </div>
  <div
    class="btns eb-at"
    style="left: 16px; top: 60px"
  >
    <KeyButton
      quiet
      md
      @click="openModal = 'ask'"
    >
      {{ t.openAsk }}
    </KeyButton>
    <KeyButton
      quiet
      md
      @click="openModal = 'list'"
    >
      {{ t.openList }}
    </KeyButton>
    <slot />
  </div>
  <KitModal
    v-if="openModal === 'ask'"
    :title="t.pauseTitle"
    :lead="t.pauseLead"
    :note="t.pauseNote"
    :width="440"
    :top="100"
    @close="openModal = null"
  >
    <template #buttons>
      <KeyButton
        primary
        sub="Enter"
        @click="openModal = null"
      >
        {{ t.resume }}
      </KeyButton>
      <KeyButton
        quiet
        @click="openModal = null"
      >
        {{ t.leave }}
      </KeyButton>
    </template>
  </KitModal>
  <KitModal
    v-else-if="openModal === 'list'"
    :title="t.listTitle"
    :lead="t.listLead"
    left
    :width="440"
    :top="100"
    @close="openModal = null"
  >
    <template #buttons>
      <span />
      <KeyButton
        quiet
        md
        sub="Esc"
        @click="openModal = null"
      >
        {{ ru.kit.close }}
      </KeyButton>
    </template>
  </KitModal>
</template>
