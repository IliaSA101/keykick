<script setup lang="ts">
/*
 * Комплект: футболка, шорты, гетры и (если переданы) бутсы — спека 004, design.md §5.
 * row — футболка слева в своём размере (--shirt от родителя), справа колонкой шорты над гетрами,
 *   бутсы — справа от гетр; высота колонки = высоте футболки (пак, «На тебе» в шкафчике).
 * stack — бока поля матча: футболка, под ней шорты, ниже гетры с бутсами. Колонка уже
 *   OUTFIT_MIN_WIDTH — только футболка: мелкие гетры не разглядеть (развилка 004-Р7).
 * Шорты, гетры и бутсы показываются, когда их слои загружены: до того размер холста
 * неизвестен, и комплект прыгал бы по ширине.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { loadedKitBase, loadOutfitBases } from '../app/kitBase';
import type { Boots } from '../engine/boots';
import type { shirtBack } from '../engine/club';
import type { Kit } from '../engine/kit';
import { ru } from '../i18n/ru';
import KitView from './KitView.vue';

/** Колонка уже (в px вёрстки) — в stack только футболка. */
const OUTFIT_MIN_WIDTH = 150;

const props = withDefaults(
  defineProps<{ kit: Kit; back?: ReturnType<typeof shirtBack>; boots?: Boots | null; layout: 'row' | 'stack' }>(),
  { back: null, boots: null },
);

const ready = ref(loadedKitBase('shorts') !== null && loadedKitBase('socks') !== null && loadedKitBase('boots') !== null);
const wide = ref(props.layout === 'row');
const root = ref<HTMLElement | null>(null);
let observer: ResizeObserver | null = null;

onMounted(() => {
  loadOutfitBases()
    .then(() => {
      ready.value = true;
    })
    // Сбой сети — останется одна футболка, как было до комплекта.
    .catch(() => undefined);
  if (props.layout !== 'stack' || !root.value) return;
  // offsetWidth — в px вёрстки, без множителя увеличения (zoom каркаса, app/viewport).
  const measure = (): void => {
    wide.value = (root.value?.offsetWidth ?? 0) >= OUTFIT_MIN_WIDTH;
  };
  measure();
  observer = new ResizeObserver(measure);
  observer.observe(root.value);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div
    ref="root"
    class="outfit"
    :class="layout"
    role="group"
    :aria-label="ru.boots.outfit"
  >
    <div class="shirt">
      <KitView
        :kit="kit"
        :back="back"
      />
    </div>
    <div
      v-if="ready && wide"
      class="rest"
    >
      <KitView
        class="shorts"
        view="shorts"
        :kit="kit"
      />
      <div class="legs">
        <KitView
          class="socks"
          view="socks"
          :kit="kit"
        />
        <KitView
          v-if="boots"
          class="boots"
          view="boots"
          :boots="boots"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ряд: футболка --shirt (задаёт родитель; нет — 200px) в квадрат, колонка справа той же высоты. */
.outfit.row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--shirt, 200px) * 0.04);
}

.row .shirt {
  flex: none;
  width: var(--shirt, 200px);
}

.row .rest {
  height: var(--shirt, 200px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(var(--shirt, 200px) * 0.03);
}

.row .legs {
  display: flex;
  align-items: flex-end;
  gap: calc(var(--shirt, 200px) * 0.03);
}

/* Высоты — доли футболки: в сумме с зазорами она и есть. Ширина — от пропорций холста. */
.row .rest .kit.shorts {
  width: auto;
  height: calc(var(--shirt, 200px) * 0.44);
}

.row .rest .kit.socks {
  width: auto;
  height: calc(var(--shirt, 200px) * 0.5);
}

.row .rest .kit.boots {
  width: auto;
  height: calc(var(--shirt, 200px) * 0.25);
}

/* Столбик: всё по ширине колонки; шорты чуть заходят под край футболки, как надетые. */
.outfit.stack {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stack .shirt {
  position: relative;
  z-index: 1;
  width: 100%;
}

.stack .rest {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stack .rest .kit.shorts {
  width: 62%;
  margin-top: -6%;
}

.stack .legs {
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 4%;
  margin-top: 2%;
}

.stack .rest .kit.socks {
  width: 34%;
}

.stack .rest .kit.boots {
  width: 50%;
}
</style>
