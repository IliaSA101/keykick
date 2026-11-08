<script setup lang="ts">
// Показ формы клуба вживую (спека 019, К8): рубашка, название и город. Только показ.
import type { Kit } from '../../engine/kit';
import { ru } from '../../i18n/ru';
import KitView from '../KitView.vue';

defineProps<{ kit: Kit; name: string; city: string }>();
</script>

<template>
  <aside class="panel preview">
    <h2>{{ ru.clubForm.kitTitle }}</h2>
    <div class="shirt">
      <KitView :kit="kit" />
    </div>
    <span class="preview-name">{{ name }}</span>
    <span class="preview-city">{{ city }}</span>
  </aside>
</template>

<style scoped>
.preview {
  text-align: center;
}

h2 {
  margin: 0 0 var(--space-2);
  font-size: 1.1rem;
}

/* По высоте окна тоже: на 1024×640 форма и поле должны влезать без прокрутки. */
.shirt {
  max-width: min(220px, 34vh / var(--ui-scale));
  margin: 0 auto;
}

.preview-name {
  display: block;
  margin-top: var(--space-1);
  font-weight: 800;
  font-size: 1.4rem;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.preview-city {
  display: block;
  min-height: 1.5em;
  color: var(--text-muted);
}
</style>
