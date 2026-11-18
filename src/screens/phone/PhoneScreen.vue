<script setup lang="ts">
/**
 * «Открой на компьютере» (059-В7, 063 Т12б; кадры Э6.99–102): страница телефона и планшета без клавиатуры. Охрана входа
 * (`engine/players/entry.ts`, правило `engine/phone/rule.ts`) ведёт сюда до всего; экран ничего не читает из сохранения
 * и ничего не пишет. «Посмотреть Путь клуба» — витрина без игры: адрес `#/phone?view=club` (кнопка «Назад» браузера — к странице).
 * Оболочка (`StageScale`) уменьшает сцену до окна телефона, поэтому экран возвращает реальный размер обратным `zoom`:
 * вёрстка — в настоящих px окна, как на кадрах Э6.99–102 (390×844 и 820×1180).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { addressNow } from '../../app/phone/device';
import { artUrl } from '../../art/assets';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitPanel from '../../components/kit/KitPanel.vue';
import { stageScale } from '../../components/shell/stageScale';
import { ru } from '../../i18n/ru';
import PhoneShowcase from './PhoneShowcase.vue';

/** С этой ширины (px) — «планшет»: заголовок и адрес крупнее (Э6.100). */
const BIG_FROM = 500;

const t = ru.phone;
const route = useRoute();
const router = useRouter();
const win = ref({ w: globalThis.innerWidth, h: globalThis.innerHeight });
const onResize = (): void => void (win.value = { w: globalThis.innerWidth, h: globalThis.innerHeight });
onMounted(() => globalThis.addEventListener('resize', onResize));
onBeforeUnmount(() => globalThis.removeEventListener('resize', onResize));

const box = computed(() => ({ width: `${win.value.w}px`, height: `${win.value.h}px`, zoom: String(1 / stageScale(win.value.w, win.value.h).scale) }));
const big = computed(() => win.value.w > BIG_FROM);
const shown = computed(() => route.query.view === 'club');
const address = addressNow();

const open = (): void => void router.push({ path: '/phone', query: { view: 'club' } });
const back = (): void => void router.back();
</script>

<template>
  <main
    class="phone"
    :class="{ big }"
    :style="box"
  >
    <PhoneShowcase
      v-if="shown"
      :width="win.w"
      @back="back"
    />
    <div
      v-else
      class="col"
    >
      <img
        class="logo"
        :src="artUrl('logo')"
        :alt="ru.frame.logoAlt"
      >
      <h1>{{ t.title }}</h1>
      <p>{{ t.lead }}</p>
      <KitPanel
        soft
        class="addr"
        role="group"
        :aria-label="t.addressLabel"
      >
        <b>{{ address }}</b>
      </KitPanel>
      <KeyButton
        :md="!big"
        @click="open"
      >
        {{ t.showcase }}
      </KeyButton>
    </div>
  </main>
</template>

<style scoped>
.phone {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  overflow-y: auto;
  color: var(--text);
}
.col {
  box-sizing: border-box;
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 24px;
  text-align: center;
}
.logo {
  height: 40px;
  width: auto;
}
h1 {
  margin: 0;
  font-size: 26px;
  line-height: 1.15;
}
p {
  margin: 0;
  font-size: 17px;
}
.addr {
  position: relative; /* `.card` кита — absolute: без этого плашка выпадает из потока и налезает на заголовок */
  padding: 14px 18px;
  max-width: 100%;
  overflow-wrap: anywhere;
  user-select: text; /* адрес можно выделить и скопировать */
}
.addr b {
  font-size: 22px;
  letter-spacing: 0.2px;
}
.big .logo {
  height: 56px;
}
.big h1 {
  font-size: 36px;
}
.big p {
  font-size: 22px;
}
.big .addr {
  padding: 18px 28px;
}
.big .addr b {
  font-size: 34px;
}
</style>
