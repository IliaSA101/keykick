<script setup lang="ts">
/*
 * Перерыв (спека 017, design §1, §1.1): счёт 1-го тайма и «Второй тайм» по Enter. После перезагрузки
 * во 2-м тайме (баннер `continue2`) — «Продолжить 2-й тайм» с тем же счётом. Enter ловит экран матча.
 */
import { computed } from 'vue';
import KeyButton from '../KeyButton.vue';
import { ru } from '../../i18n/ru';

const props = defineProps<{
  us: string;
  rival: string;
  /** Голы 1-го тайма (печать и пенальти) и пропущенные. */
  goals: number;
  conceded: number;
  /** Вернулись после перезагрузки: «Продолжить 2-й тайм». */
  continue2?: boolean;
}>();

defineEmits<{ next: [] }>();

const t = ru.match2.break;
// «Продолжить 2-й тайм (счёт 1-го a:b)» — счёт на кнопке, как у точки карты.
const nextLabel = computed(() =>
  props.continue2 ? t.continue2.replace('{a}', String(props.goals)).replace('{b}', String(props.conceded)) : t.next,
);
</script>

<template>
  <div class="break">
    <h2 class="title">
      {{ t.title }}
    </h2>
    <p class="first">
      {{ t.first }}: <b class="score">{{ goals }} : {{ conceded }}</b>
    </p>
    <p class="teams">
      {{ us }} — {{ rival }}
    </p>
    <div class="go">
      <KeyButton
        primary
        @click="$emit('next')"
      >
        {{ nextLabel }}
      </KeyButton>
      <span>{{ t.key }}</span>
    </div>
  </div>
</template>

<style scoped>
.break {
  position: relative;
  max-width: 520px;
  margin: 0 auto;
  padding: var(--space-3) var(--space-4);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text);
  text-align: center;
  box-shadow: 0 6px 18px rgb(0 0 0 / 0.25);
}

/* «Перерыв» уже на табло: заголовок остался для экранного диктора (017-Р31, дубль убран). */
.title {
  margin: 0;
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.first {
  margin: 0;
}

.score {
  font-size: 1.4rem;
}

.teams {
  margin: 0 0 var(--space-2);
  color: var(--text-muted);
  font-size: 0.85rem;
}

.go {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--text-muted);
  font-size: 0.8rem;
}
</style>
