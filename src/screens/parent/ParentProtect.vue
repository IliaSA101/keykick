<script setup lang="ts">
/** Блок «Защита от очистки» (063-Р8): `persist()` только кнопкой взрослого и показ состояния (Firefox спрашивает разрешение — не ребёнка). */
import { onMounted, ref } from 'vue';
import { browserPersist, createPersist, type PersistState } from '../../app/save/persist';
import KeyButton from '../../components/kit/KeyButton.vue';
import { ru } from '../../i18n/ru';

const p = ru.parent;
/** `unknown` — ещё не спрашивали: текста нет, пока `state()` не ответил или кнопку не нажали. */
const persisted = ref<PersistState | 'unknown'>('unknown');
const asked = ref(false);
const persist = createPersist(browserPersist());

onMounted(async () => {
  persisted.value = await persist.state();
});

async function protect(): Promise<void> {
  persisted.value = await persist.request();
  asked.value = true;
}
</script>

<template>
  <section class="pa-blk">
    <h2>{{ p.protect.title }}</h2>
    <p class="pa-hint">
      {{ p.protect.lead }}
    </p>
    <div
      v-if="persisted === 'not-persisted'"
      class="pa-row"
    >
      <KeyButton
        md
        quiet
        @click="protect"
      >
        {{ p.protect.button }}
      </KeyButton>
    </div>
    <p
      v-if="persisted === 'persisted' || persisted === 'unsupported' || (persisted === 'not-persisted' && asked)"
      class="pa-note"
      role="status"
    >
      {{ persisted === 'persisted' ? p.protect.yes : persisted === 'unsupported' ? p.protect.unsupported : p.protect.no }}
    </p>
  </section>
</template>
