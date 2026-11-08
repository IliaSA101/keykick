<script setup lang="ts">
/*
 * Форма «Новый игрок»: имя → создать и играть за него. Enter в поле создаёт, Esc закрывает.
 * Что дальше (первый запуск и клуб нового игрока) решает охрана входа — форма только сообщает `created`.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { createPlayer, newNameError, writeRefused } from '../../app/roster';
import { PLAYER_NAME_MAX } from '../../engine/players';
import { ru } from '../../i18n/ru';
import KeyButton from '../KeyButton.vue';

const emit = defineEmits<{ created: []; cancel: [] }>();

const t = ru.players;
const name = ref('');
const touched = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);
const form = ref<HTMLFormElement | null>(null);
// Список игроков не записался (нет места): сказать об этом под полем, пока имя не поменяют.
const refused = ref(false);
watch(name, () => {
  refused.value = false;
});
const error = computed(() => {
  if (refused.value) return t.saveRefused;
  if (!touched.value) return null;
  const e = newNameError(name.value);
  return e === null ? null : t.nameErrors[e];
});

onMounted(() => {
  void nextTick(() => {
    nameInput.value?.focus();
    // Форма — под карточками: в окне 1024×640 её кнопки иначе за краем.
    form.value?.scrollIntoView({ block: 'nearest' });
  });
});

function create(): void {
  touched.value = true;
  if (newNameError(name.value) !== null) {
    nameInput.value?.focus();
    return;
  }
  if (createPlayer(name.value, true) !== null) emit('created');
  else refused.value = writeRefused.value;
}
</script>

<template>
  <form
    ref="form"
    class="panel add-form"
    @submit.prevent="create"
  >
    <h2>{{ t.addTitle }}</h2>
    <label
      class="label"
      for="player-name"
    >{{ t.nameLabel }}</label>
    <input
      id="player-name"
      ref="nameInput"
      v-model="name"
      class="field"
      type="text"
      :maxlength="PLAYER_NAME_MAX + 4"
      autocomplete="off"
      spellcheck="false"
      :aria-invalid="error !== null"
      aria-describedby="player-name-error"
      @keydown.esc.prevent="emit('cancel')"
    >
    <p
      id="player-name-error"
      class="error"
      role="alert"
    >
      {{ error ?? '' }}
    </p>
    <div class="row">
      <button
        type="submit"
        class="submit"
      >
        {{ t.create }}
      </button>
      <KeyButton @click="emit('cancel')">
        {{ t.cancel }}
      </KeyButton>
    </div>
  </form>
</template>

<style scoped>
.add-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 520px;
}

.add-form h2 {
  margin: 0;
  font-size: 1.3rem;
}

.label {
  font-weight: 700;
}

.field {
  box-sizing: border-box;
  min-height: 48px;
  padding: 0 var(--space-3);
  border: 3px solid #f4c24a;
  border-radius: 12px;
  background: #fff6e0;
  color: #1f2152;
  font: inherit;
  font-size: 1.3rem;
  font-weight: 800;
}

.field:focus-visible {
  outline: 4px solid #6fd34a;
  outline-offset: 2px;
}

.error {
  min-height: 1.5em;
  margin: 0;
  /* Светлее общего --error: на тёмно-синей панели читается лучше. */
  color: #ff9e9e;
  font-weight: 700;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: center;
}

/* Главная кнопка формы — как зелёная «клавиша», но настоящий submit: Enter в поле создаёт. */
.submit {
  min-height: 44px;
  padding: 14px 24px;
  border: 0;
  border-radius: 16px;
  font: inherit;
  font-weight: 800;
  font-size: 1.15rem;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(#6fd34a, #2f9a27);
  box-shadow:
    0 6px 0 #1d6b18,
    0 0 0 3px #f4c24a;
  text-shadow: 0 2px 0 #1d6b18;
}

.submit:active {
  transform: translateY(4px);
  box-shadow:
    0 2px 0 #1d6b18,
    0 0 0 3px #f4c24a;
}

.submit:focus-visible {
  outline: 4px solid #f4c24a;
  outline-offset: 4px;
}
</style>
