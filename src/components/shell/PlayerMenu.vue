<script setup lang="ts">
/**
 * Меню игрока в шапке (068-Р82, владелец 19.11): кнопка «Саша ▾» рядом со звуком, по нажатию — «Сменить игрока», «Что нового · v2.0»
 * (строка без действия, 063-Р67), «Старая версия», разделитель и «Взрослым: отзыв ↗ · форма ↗». Заменяет нижнюю строку «Игрок: …» и
 * ссылки Дома. Открывается мышью и с клавиатуры (Tab, Enter/Пробел), Esc и клик мимо закрывают; буквы набора кнопку не трогают
 * (в матче меню нет вовсе). Пока меню открыто, Esc гасится здесь и до окон экрана не доходит. Цвет — белый, фокус — белая обводка (ТАБУ).
 */
import { computed, onUnmounted, ref, watch } from 'vue';
import { useSession } from '../../app/save/session';
import cfg from '../../content/support.json';
import { playerMenu, type ParentLinkKind } from '../../engine/support';
import { APP_VERSION } from '../../engine/save/envelope';
import { ru } from '../../i18n/ru';
import { clipName, oldVersionUrl } from './footer';

const session = useSession();
const name = computed(() => (session.player.value.kind === 'ok' ? session.player.value.env.name : ''));
const menu = computed(() => playerMenu({ telegram: ru.system.telegram.url, form: ru.system.form.url, donate: cfg.donate.url }));
const label = (k: ParentLinkKind): string => (k === 'telegram' ? ru.support.feedback : k === 'form' ? ru.support.form : ru.support.donate);
const version = APP_VERSION.split('.').slice(0, 2).join('.');
const oldUrl = oldVersionUrl(import.meta.env.BASE_URL);

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const button = ref<HTMLButtonElement | null>(null);

function close(back = false): void {
  open.value = false;
  if (back) button.value?.focus();
}
function onKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  e.stopImmediatePropagation();
  close(true);
}
function onDown(e: Event): void {
  if (!root.value?.contains(e.target as Node)) close();
}
function onFocusOut(e: FocusEvent): void {
  if (e.relatedTarget instanceof Node && !root.value?.contains(e.relatedTarget)) close();
}
function bind(on: boolean): void {
  const f = on ? globalThis.addEventListener : globalThis.removeEventListener;
  f('keydown', onKey, true);
  f('pointerdown', onDown, true);
}
watch(open, bind);
onUnmounted(() => bind(false));
</script>

<template>
  <div
    v-if="name !== ''"
    ref="root"
    class="kb-who"
    @focusout="onFocusOut"
  >
    <button
      ref="button"
      type="button"
      class="kb-who-btn"
      :title="name"
      :aria-label="`${ru.frame.playerMenu.open}: ${name}`"
      aria-haspopup="true"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="nm">{{ clipName(name, 12) }}</span><span
        class="ar"
        aria-hidden="true"
      >▾</span>
    </button>
    <div
      v-if="open"
      class="kb-who-panel"
    >
      <template
        v-for="a in menu.actions"
        :key="a"
      >
        <a
          v-if="a === 'change'"
          href="#/who"
          @click="close()"
        >{{ ru.frame.playerMenu.change }}</a>
        <p
          v-else-if="a === 'news'"
          class="ver"
        >
          {{ ru.frame.footer.news }} · v{{ version }}
        </p>
        <a
          v-else
          :href="oldUrl"
          target="_blank"
          rel="noopener"
          @click="close()"
        >{{ ru.frame.footer.oldVersion }}</a>
      </template>
      <template v-if="menu.adults.length > 0">
        <hr>
        <p class="adults">
          {{ ru.support.adults }}
        </p>
        <a
          v-for="l in menu.adults"
          :key="l.kind"
          :href="l.url"
          target="_blank"
          rel="noopener"
          @click="close()"
        >{{ label(l.kind) }} ↗</a>
      </template>
    </div>
  </div>
</template>

<style scoped>
.kb-who {
  position: relative;
}
.kb-who-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  box-sizing: border-box;
  padding: 0 10px;
  border-radius: 15px;
  background: rgb(21 20 58 / 0.85);
  border: 1.5px solid var(--border);
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
}
.kb-who-btn:focus-visible,
.kb-who-panel a:focus-visible {
  outline: 3px solid var(--text);
  outline-offset: 2px;
}
.kb-who-panel {
  position: absolute;
  z-index: 30;
  top: 36px;
  right: 0;
  min-width: 190px;
  box-sizing: border-box;
  padding: 6px;
  display: grid;
  gap: 2px;
  border-radius: 10px;
  background: rgb(21 20 58 / 0.97);
  border: 1.5px solid var(--border);
  box-shadow: 0 6px 16px rgb(0 0 0 / 0.45);
  font-size: 13px;
  white-space: nowrap;
}
.kb-who-panel a {
  display: block;
  padding: 6px 10px;
  border-radius: 6px;
  color: var(--text);
  text-decoration: none;
  font-weight: 700;
}
.kb-who-panel a:hover {
  background: rgb(255 255 255 / 0.12);
}
.kb-who-panel p {
  margin: 0;
  padding: 6px 10px;
  color: var(--text-muted);
}
.kb-who-panel hr {
  width: 100%;
  margin: 4px 0;
  border: 0;
  border-top: 1px solid var(--border);
}
.kb-who-panel .adults {
  padding-bottom: 0;
  font-size: 12px;
}
</style>
