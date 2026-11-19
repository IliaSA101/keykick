<script setup lang="ts">
/**
 * «Рассмотреть» (067 Т13, 049-Р18, Р36; Э2К.22–24): собранная форма крупно — спереди и сзади, с шортами и гетрами; ← → листают
 * собранные формы по кругу (`neighbour`), «Надеть» (Enter) просит запись у экрана, «Назад» (Esc) закрывает. Надетая форма — метка «На тебе»,
 * кнопки «Надеть» нет. Вторая вкладка (`readonly`) — «Надеть» погашена. Окно ничего не пишет: `wear` уходит экрану.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useStageWidth } from '../../components/home/useStageWidth';
import { fill } from '../../app/home/texts';
import { lookOf } from '../../app/album/locker';
import ShirtView from '../../components/club/ShirtView.vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitModal from '../../components/panel/KitModal.vue';
import { ENTER_DELAY } from '../../components/panel/focusCycle';
import { isFoil } from '../../engine/album/order';
import { neighbour } from '../../engine/album/locker';
import type { ClubKit } from '../../engine/club/section';
import { ru } from '../../i18n/ru';

const props = defineProps<{ ids: readonly string[]; start: string; worn: string | null; club: ClubKit; boots: string; back: { name: string; number: number }; editable: boolean }>();
const emit = defineEmits<{ wear: [id: string]; close: [] }>();
const t = ru.album.view;
// размеры макета Э2К.22/.23: на 1920 окно 760, форма 205 px, верх 90; на узком окне — 700, 214 и 86 (сцена 1024 px)
const width = useStageWidth();
const wide = computed(() => width.value > 1024);

const cur = ref(props.ids.includes(props.start) ? props.start : (props.ids[0] ?? ''));
const look = computed(() => lookOf(cur.value, props.club));
const foil = computed(() => isFoil(cur.value));
const on = computed(() => props.worn === cur.value);
const at = computed(() => props.ids.indexOf(cur.value) + 1);

function turn(dir: -1 | 1): void {
  cur.value = neighbour(props.ids, cur.value, dir) ?? cur.value;
}
function onKey(e: KeyboardEvent): void {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    turn(e.key === 'ArrowLeft' ? -1 : 1);
  }
}
onMounted(() => globalThis.addEventListener('keydown', onKey));
onUnmounted(() => globalThis.removeEventListener('keydown', onKey));
</script>

<template>
  <KitModal
    class="kv"
    :title="`«${look.name ?? ''}»`"
    :width="wide ? 760 : 700"
    :top="wide ? 90 : 86"
    :enter-delay="ENTER_DELAY"
    @close="emit('close')"
  >
    <template #head>
      <span class="half">{{ foil ? t.half2 : t.half1 }}</span>
      <span
        v-if="ids.length > 0"
        class="count"
      >{{ fill(t.counter, { i: at, n: ids.length }) }}</span>
    </template>
    <p
      v-if="ids.length === 0"
      class="empty"
    >
      {{ t.empty }}
    </p>
    <template v-else>
      <div
        class="pair"
        :style="{ '--kit': `${wide ? 205 : 214}px` }"
      >
        <button
          type="button"
          class="arr"
          aria-label="←"
          @click="turn(-1)"
        >
          ‹
        </button>
        <figure class="kh">
          <ShirtView
            :kit="look.kit"
            :label="`${t.front}: ${look.name}`"
            crop
          />
        </figure>
        <figure class="kh">
          <ShirtView
            :kit="look.kit"
            :back="back"
            :label="`${t.back}: ${look.name}`"
            crop
          />
        </figure>
        <button
          type="button"
          class="arr"
          aria-label="→"
          @click="turn(1)"
        >
          ›
        </button>
      </div>
      <div class="parts">
        <figure class="kp sh">
          <ShirtView
            :kit="look.kit"
            part="shorts"
            :label="ru.album.pack.partName.shorts"
            crop
          />
        </figure>
        <figure class="kp so">
          <ShirtView
            :kit="look.kit"
            part="socks"
            :label="ru.album.pack.partName.socks"
            crop
          />
        </figure>
        <figure class="kp bo">
          <img
            :src="boots"
            alt=""
          >
        </figure>
      </div>
    </template>
    <template #buttons>
      <KeyButton
        v-if="ids.length > 0 && !on"
        class="eq"
        primary
        :sub="ru.kit.enter"
        :state="editable ? undefined : 'off'"
        @click="emit('wear', cur)"
      >
        {{ ru.album.pack.wear }}
      </KeyButton>
      <span
        v-else-if="ids.length > 0"
        class="on"
      >{{ ru.album.locker.worn }}</span>
      <KeyButton
        class="eq"
        quiet
        :sub="ru.kit.esc"
        @click="emit('close')"
      >
        {{ ru.handsHelp.back }}
      </KeyButton>
    </template>
  </KitModal>
</template>

<style scoped>
/* числа — единицы макета Э2К (collection-e.css, .ce-vstage, .ce-vparts): «Надеть» и «Назад» — одной высоты (049-Р36) */
.empty { margin: 0; color: var(--text-muted); }
.half { font-size: 14px; color: var(--text-muted); }
.count { font-size: 12px; color: var(--text-muted); padding: 3px 10px; border-radius: 999px; background: #ffffff14; }
/* заголовок окна — одной строкой, как .ce-vtop макета: имя, половина альбома, счётчик; окно плотнее обычной модалки */
.kv :deep(.mhead) { justify-content: center; align-items: baseline; gap: 12px; }
.kv :deep(.mhead h2) { font-size: 20px; }
.kv :deep(.kb-modal) { gap: 8px; padding: 12px 18px 24px; }
.pair { display: flex; align-items: center; justify-content: center; gap: 28px; width: 100%; box-sizing: border-box; padding: 12px 0; border-radius: 16px; background: radial-gradient(ellipse at 50% 40%, #23265d, #11122c 70%); }
.kh { margin: 0; height: var(--kit); display: flex; }
.kh > :deep(.shirt) { height: 100%; width: auto; }
.arr { width: 40px; height: 40px; border-radius: 50%; border: 0; font-size: 26px; cursor: pointer; background: #ffffff1f; color: #fff; }
.arr:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.parts { display: flex; justify-content: center; align-items: flex-end; gap: 26px; padding: 8px 22px; border-radius: 12px; background: #151739; }
.kp { margin: 0; }
.kp > :deep(.shirt) { width: auto; }
.kp.sh > :deep(.shirt) { height: 80px; }
.kp.so > :deep(.shirt) { height: 92px; }
.kp.bo { transform: translateY(2px); }
.kp.bo img { display: block; height: 56px; width: auto; }
.eq { align-self: stretch; }
/* «Назад Esc» — одной строкой, клавиша плашкой справа (эталон Э2К.22, .ce-vback), ширина не уже «Надеть» (049-Р36) */
.eq.close { flex-direction: row; gap: 8px; min-width: 150px; white-space: nowrap; }
.eq.close :deep(small) { padding: 1px 6px; border-radius: 5px; background: rgb(255 255 255 / 0.14); font-size: 12px; }
.on { font-weight: 800; color: #fff; padding: 0 12px; }
</style>
