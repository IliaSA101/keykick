<script setup lang="ts">
/*
 * «Кто играет?» (#/players): карточки игроков этого компьютера и «Новый игрок».
 * Открывается сам, когда игроков двое и больше и в этой вкладке ещё не выбран, и по «Сменить».
 * Карточки — кнопки: Tab и Enter, стрелки ходят между ними.
 */
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import KitView from '../components/KitView.vue';
import KeyButton from '../components/KeyButton.vue';
import { players, playingId } from '../app/players';
import { lessonAt, peekSave } from '../app/progress';
import { choosePlayer, createPlayer, newNameError } from '../app/roster';
import { lessons } from '../app/lessons';
import { clubKit } from '../engine/club';
import { PLAYERS_MAX, PLAYER_NAME_MAX } from '../engine/players';
import { ru } from '../i18n/ru';

const t = ru.players;
const router = useRouter();

// Сохранения читаются один раз: пока экран открыт, прогресс игроков не меняется.
const cards = computed(() =>
  players.players.map((p) => {
    const save = peekSave(p.id);
    const lesson = lessonAt(save.lessonIndex);
    return {
      id: p.id,
      name: p.name,
      club: save.club,
      kit: save.club ? clubKit(save.club) : null,
      lesson: `${t.lesson} ${lessons.indexOf(lesson) + 1}`,
      playing: p.id === playingId.value,
    };
  }),
);

const canAdd = computed(() => players.players.length < PLAYERS_MAX);

const list = ref<HTMLElement | null>(null);

function buttons(): HTMLButtonElement[] {
  return [...(list.value?.querySelectorAll<HTMLButtonElement>('button.card') ?? [])];
}

/** Стрелки — к соседней карточке по кругу. */
function onArrow(e: KeyboardEvent): void {
  const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
  if (step === 0) return;
  const all = buttons();
  const i = all.findIndex((b) => b === e.target);
  if (i < 0) return;
  e.preventDefault();
  all[(i + step + all.length) % all.length]?.focus();
}

function play(id: string): void {
  choosePlayer(id);
  void router.push('/');
}

// Новый игрок: имя → создать и войти; новый игрок начинает с экрана клуба.
const adding = ref(false);
const name = ref('');
const touched = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);
const addButton = ref<HTMLButtonElement | null>(null);
const addForm = ref<HTMLFormElement | null>(null);
const error = computed(() => {
  if (!touched.value) return null;
  const e = newNameError(name.value);
  return e === null ? null : t.nameErrors[e];
});

function openAdd(): void {
  adding.value = true;
  name.value = '';
  touched.value = false;
  void nextTick(() => {
    nameInput.value?.focus();
    // Форма — под карточками: в окне 1024×640 её кнопки иначе за краем.
    addForm.value?.scrollIntoView({ block: 'nearest' });
  });
}

function cancelAdd(): void {
  adding.value = false;
  void nextTick(() => addButton.value?.focus());
}

function create(): void {
  touched.value = true;
  if (newNameError(name.value) !== null) {
    nameInput.value?.focus();
    return;
  }
  if (createPlayer(name.value, true) !== null) void router.push('/club');
}

// Фокус — на последнем выбранном: Enter сразу продолжает его игру.
onMounted(() => {
  const all = buttons();
  const i = players.players.findIndex((p) => p.id === (playingId.value ?? players.current));
  all[Math.max(0, i)]?.focus();
});
</script>

<template>
  <section class="players">
    <header class="panel head">
      <h1>{{ t.title }}</h1>
      <p>{{ t.lead }}</p>
    </header>

    <ul
      ref="list"
      class="cards"
      @keydown="onArrow"
    >
      <li
        v-for="c in cards"
        :key="c.id"
      >
        <button
          type="button"
          class="card"
          :class="{ playing: c.playing }"
          @click="play(c.id)"
        >
          <span class="kit">
            <KitView
              v-if="c.kit"
              :kit="c.kit"
            />
            <span
              v-else
              class="no-kit"
              aria-hidden="true"
            >{{ c.name.slice(0, 1).toUpperCase() }}</span>
          </span>
          <span class="name">{{ c.name }}</span>
          <span class="club">{{ c.club ? c.club.name : t.noClub }}</span>
          <span class="lesson">{{ c.lesson }}</span>
          <span
            v-if="c.playing"
            class="badge"
          >{{ t.playing }}</span>
        </button>
      </li>
      <li v-if="canAdd && !adding">
        <button
          ref="addButton"
          type="button"
          class="card add"
          @click="openAdd"
        >
          <span
            class="plus"
            aria-hidden="true"
          >+</span>
          <span class="name">{{ t.add }}</span>
        </button>
      </li>
    </ul>

    <p
      v-if="!canAdd"
      class="panel note"
    >
      {{ t.full }}
    </p>

    <form
      v-if="adding"
      ref="addForm"
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
        @keydown.esc.prevent="cancelAdd"
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
        <KeyButton @click="cancelAdd">
          {{ t.cancel }}
        </KeyButton>
      </div>
    </form>
  </section>
</template>

<style scoped>
.players {
  max-width: 920px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.head h1 {
  margin: 0;
}

.head p {
  margin: var(--space-1) 0 0;
  color: var(--text-muted);
}

.cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: var(--space-4);
}

/* Карточка — большая кнопка целиком: форма клуба, имя, клуб и урок. */
.card {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-3);
  border: 3px solid rgb(244 194 74 / 0.55);
  border-radius: 18px;
  background: linear-gradient(160deg, rgb(58 63 134 / 0.94), rgb(31 33 82 / 0.94));
  color: var(--text);
  font: inherit;
  cursor: pointer;
  box-shadow: 0 10px 24px rgb(0 0 0 / 0.4);
  transition: transform 0.08s;
}

.card:hover {
  transform: translateY(-3px);
  border-color: #f4c24a;
}

.card:focus-visible {
  outline: 4px solid #f4c24a;
  outline-offset: 4px;
}

.card.playing {
  border-color: #6fd34a;
}

.kit {
  width: 110px;
  height: 110px;
  display: grid;
  place-items: center;
}

.no-kit {
  width: 84px;
  height: 84px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.12);
  color: #f4c24a;
  font-size: 2.6rem;
  font-weight: 900;
}

.name {
  font-size: 1.4rem;
  font-weight: 900;
}

.club {
  color: #f4c24a;
  font-weight: 700;
}

.lesson {
  color: var(--text-muted);
}

.badge {
  margin-top: var(--space-1);
  padding: 2px 12px;
  border-radius: 999px;
  background: #6fd34a;
  color: #10231b;
  font-size: 0.85rem;
  font-weight: 800;
}

.card.add {
  justify-content: center;
  border-style: dashed;
  background: rgb(255 255 255 / 0.06);
}

.plus {
  font-size: 3.4rem;
  line-height: 1;
  font-weight: 900;
  color: #f4c24a;
}

.note {
  margin: 0;
  color: var(--text-muted);
}

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
