<script setup lang="ts">
// Карточка первого запуска (спека 019, design §3, шаг 1): «Новый клуб, новый сезон». Две строки и кнопка.
// Вторая строка годится и новичку; «старая версия» открывается в новой вкладке — черновик не теряется (Р14).
import { onMounted, ref } from 'vue';
import { ru } from '../../i18n/ru';
import KeyButton from '../KeyButton.vue';

defineProps<{ oldUrl: string }>();
const emit = defineEmits<{ start: [] }>();

const root = ref<HTMLElement | null>(null);
// Главная кнопка сразу в фокусе: Enter — «Создать клуб».
onMounted(() => root.value?.querySelector('button')?.focus());
</script>

<template>
  <section
    ref="root"
    class="panel card"
    aria-labelledby="new-season-title"
  >
    <h1 id="new-season-title">
      {{ ru.firstRun.card.title }}
    </h1>
    <p class="lead">
      {{ ru.firstRun.card.lead }}
    </p>
    <p class="old">
      {{ ru.firstRun.card.oldBefore }}<a
        :href="oldUrl"
        target="_blank"
        rel="noopener"
      >{{ ru.firstRun.card.oldLink }}</a>{{ ru.firstRun.card.oldAfter }}
    </p>
    <KeyButton
      primary
      @click="emit('start')"
    >
      {{ ru.firstRun.card.start }}
    </KeyButton>
  </section>
</template>

<style scoped>
.card {
  max-width: 640px;
  margin: 0 auto;
  text-align: center;
  color: var(--text);
}

h1 {
  margin: 0 0 var(--space-3);
  font-size: 2rem;
  line-height: 1.2;
}

.lead {
  margin: 0 0 var(--space-2);
  font-size: 1.2rem;
}

.old {
  margin: 0 0 var(--space-4);
  color: var(--text-muted);
}

.old a {
  color: var(--text);
  font-weight: 800;
}

.old a:focus-visible {
  outline: 4px solid var(--text);
  outline-offset: 2px;
}
</style>
