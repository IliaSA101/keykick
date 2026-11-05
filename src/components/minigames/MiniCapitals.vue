<script setup lang="ts">
/*
 * «Заглавная»: набрать имена и города с большой буквы. Заглавная засчитывается, только если зажат
 * Shift другой руки (правило слепой печати); иначе курсор стоит и горит подсказка — без проигрыша.
 * Какой Shift зажат, видно лишь по его собственным нажатиям: следим за keydown/keyup Shift.
 * Строка и проверка — в движке (engine/minigames), здесь ввод и показ.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import KeyboardView from '../KeyboardView.vue';
import TypingLine from '../TypingLine.vue';
import { keymap } from '../../app/keymap';
import { capitals } from '../../app/minigames';
import { capitalLine, capitalShift, capitalStep } from '../../engine/minigames';
import { expectedHit, isDone, startLine, type KeyPress } from '../../engine/typing';
import { ru } from '../../i18n/ru';

const props = defineProps<{
  seed: number;
  /** Буквы урока: строка берёт сначала слова из знакомых букв. */
  known: string;
}>();
const emit = defineEmits<{ finished: [summary: string] }>();

const t = ru.halftime.capitals;
const typing = shallowRef(startLine(capitalLine(capitals, keymap, props.known, props.seed), 'ru'));
const held = new Set<string>();
const wrongShift = ref<'ShiftLeft' | 'ShiftRight' | null>(null);
const over = ref(false);

const hit = computed(() => (over.value ? null : expectedHit(keymap, typing.value)));
const hint = computed(() => {
  if (wrongShift.value) return t.wrongShift[wrongShift.value];
  const h = typing.value.hint;
  return h === 'layout' || h === 'caps' || h === 'numpad' ? ru.match.hints[h] : null;
});

function onDown(e: KeyboardEvent): void {
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    held.add(e.code);
    return;
  }
  if (over.value) return;
  const press: KeyPress = {
    code: e.code,
    key: e.key,
    repeat: e.repeat,
    mod: e.ctrlKey || e.altKey || e.metaKey,
    caps: e.getModifierState('CapsLock'),
    time: e.timeStamp,
  };
  // Печатный символ не должен листать страницу (пробел) или открывать поиск.
  if (!press.mod && [...e.key].length === 1) e.preventDefault();
  const expected = typing.value.text[typing.value.pos] ?? '';
  const r = capitalStep(keymap, typing.value, press, [...held]);
  typing.value = r.state;
  if (r.wrongShift) wrongShift.value = capitalShift(keymap, expected);
  else if (r.state.last === 'ok') wrongShift.value = null;
  if (isDone(r.state)) {
    over.value = true;
    emit('finished', t.result);
  }
}

function onUp(e: KeyboardEvent): void {
  held.delete(e.code);
}

/** Окно потеряло фокус — отпускание Shift мы не увидим: считаем, что ничего не зажато. */
function onBlur(): void {
  held.clear();
}

onMounted(() => {
  globalThis.addEventListener('keydown', onDown);
  globalThis.addEventListener('keyup', onUp);
  globalThis.addEventListener('blur', onBlur);
});
onBeforeUnmount(() => {
  globalThis.removeEventListener('keydown', onDown);
  globalThis.removeEventListener('keyup', onUp);
  globalThis.removeEventListener('blur', onBlur);
});
</script>

<template>
  <div class="capitals">
    <p class="rule">
      {{ t.rule }}
    </p>
    <div class="line">
      <TypingLine :state="typing" />
    </div>
    <p
      class="hint"
      role="status"
    >
      {{ hint ?? '' }}
    </p>
    <div class="keys">
      <KeyboardView
        :target="hit?.key ?? null"
        :shift="hit?.shift ?? false"
        :error="typing.last === 'error' || typing.last === 'hint'"
        :errors="typing.stats.errors"
        layout="ru"
      />
    </div>
  </div>
</template>

<style scoped>
.capitals {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.rule {
  margin: 0;
  font-weight: 700;
}

.line {
  width: 100%;
  max-width: 640px;
  padding: var(--space-2);
  border-radius: 12px;
  background: #2f7d32;
}

.hint {
  margin: 0;
  min-height: 1.5em;
  font-weight: 700;
  color: #ffd84a;
}

/* Клавиатура поменьше, чем в тайме: окно 1024×640 вмещает перерыв целиком, без прокрутки. */
.keys {
  width: 100%;
  max-width: 500px;
}
</style>
