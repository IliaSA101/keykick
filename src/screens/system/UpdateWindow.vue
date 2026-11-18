<script setup lang="ts">
/**
 * «Игра обновилась» (Э6.63–64) и то же окно со списком «Что нового:» (Э6.97–98, 064-Р13, 063-Р58). Кнопка одна — «Обновить · Enter»: `go`
 * (перезагрузка страницы — делает хозяин окна); Esc — `later` (окно закрыто без перезагрузки). Нет строк — окно без списка (Э6.63).
 * Не показываем посреди матча и новичку — решает тот, кто окно открывает (`SystemWindows.vue`).
 */
import KeyButton from '../../components/kit/KeyButton.vue';
import KitModal from '../../components/panel/KitModal.vue';
import { ru } from '../../i18n/ru';

defineProps<{ lines?: readonly string[] }>();
const emit = defineEmits<{ go: []; later: [] }>();
</script>

<template>
  <KitModal
    :title="ru.system.updated.title"
    :lead="lines?.length ? ru.system.updated.newsLead : ru.system.updated.lead"
    :width="600"
    :top="190"
    dim-color="rgb(10 9 32 / 0.8)"
    @close="emit('later')"
  >
    <ul
      v-if="lines?.length"
      class="news"
    >
      <li
        v-for="t in lines"
        :key="t"
      >
        {{ t }}
      </li>
    </ul>
    <KeyButton
      primary
      :sub="ru.system.enter"
      @click="emit('go')"
    >
      {{ ru.system.updated.go }}
    </KeyButton>
  </KitModal>
</template>

<style scoped>
.news {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0 0 6px;
  padding-left: 24px;
  text-align: left;
  font-size: 18px;
}
</style>
