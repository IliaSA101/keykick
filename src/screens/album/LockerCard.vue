<script setup lang="ts">
/**
 * Карточка стенда Раздевалки (067 Т13; Э2К.11, 18): форма с шортами и гетрами (у призовой — одна футболка), имя («???», пока ничего не собрано),
 * подпись состояния. Кнопки «Надеть» и «Рассмотреть» — только у карточки в фокусе (`focus`); у остальных — подпись («3 из 3 ✓», «N из 3»,
 * «есть ✓», «ещё нет») или метка «На тебе». Карточка сама ничего не пишет: выбор, «Надеть» и «Рассмотреть» уходят экрану.
 */
import ShirtView from '../../components/club/ShirtView.vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitTag from '../../components/kit/KitTag.vue';
import type { ClubKit } from '../../engine/club/section';
import { ru } from '../../i18n/ru';

defineProps<{
  kit: ClubKit;
  /** Имя для читалки экрана; видимое имя — `title`. */
  label: string;
  title: string;
  /** Призовая: одна футболка и строка «За …» (`why`). */
  prize?: boolean;
  why?: string | null;
  /** Какие части выданы; у карточки клуба и призовой — все. */
  have: boolean[];
  foil?: boolean;
  /** Подпись состояния для неактивной карточки. */
  foot: string;
  /** Дополнительная строка у карточки в фокусе (сколько ещё до сборки). */
  more?: string;
  state: 'worn' | 'wearable' | 'locked';
  focus: boolean;
  /** «Рассмотреть» есть: форма собрана и в списке просмотра. */
  canView: boolean;
  editable: boolean;
}>();
defineEmits<{ pick: []; wear: []; view: [] }>();
const t = ru.album.locker;
const ghost = (on: boolean | undefined): { ghost: boolean } => ({ ghost: !on });
</script>

<template>
  <li
    class="kc"
    :class="{ prize, focus, foil: foil && have.some(Boolean), locked: state === 'locked', full: have.some(Boolean), none: !have.some(Boolean) }"
    tabindex="0"
    @focusin="$emit('pick')"
    @click="$emit('pick')"
    @keydown.enter.self.prevent="state === 'wearable' && editable && $emit('wear')"
  >
    <i
      v-if="foil && have.some(Boolean)"
      class="foilt"
    >{{ t.foil }}</i>
    <span
      v-if="prize"
      class="pic"
      :class="ghost(have[0])"
    >
      <ShirtView
        :kit="kit"
        :label="label"
        crop
      />
    </span>
    <span
      v-else
      class="set"
    >
      <span
        class="big"
        :class="ghost(have[0])"
      >
        <ShirtView
          :kit="kit"
          :label="label"
          crop
        />
      </span>
      <span class="side">
        <span
          class="sh"
          :class="ghost(have[1])"
        >
          <ShirtView
            :kit="kit"
            part="shorts"
            :label="ru.album.pack.partName.shorts"
            crop
          />
        </span>
        <span
          class="so"
          :class="ghost(have[2])"
        >
          <ShirtView
            :kit="kit"
            part="socks"
            :label="ru.album.pack.partName.socks"
            crop
          />
        </span>
      </span>
    </span>
    <b>{{ have.some(Boolean) || prize ? title : t.unknown }}</b>
    <small v-if="why">{{ why }}</small>
    <KitTag
      v-if="state === 'worn'"
      kind="ok"
    >
      {{ t.worn }}
    </KitTag>
    <template v-if="focus">
      <small v-if="more">{{ more }}</small>
      <KeyButton
        v-if="state === 'wearable'"
        md
        sub="Enter"
        :state="editable ? undefined : 'off'"
        @click.stop="$emit('wear')"
      >
        {{ ru.album.pack.wear }}
      </KeyButton>
      <KeyButton
        v-if="canView"
        md
        @click.stop="$emit('view')"
      >
        {{ t.view }}
      </KeyButton>
    </template>
    <span
      v-if="state !== 'worn' && !(focus && state === 'wearable')"
      class="foot"
      :class="{ ok: state !== 'locked' }"
    >{{ foot }}</span>
  </li>
</template>

<style scoped>
/* числа — единицы макета Э2К (collection-e.css, .ce-fc): плитка #1a1c45, зелёная кайма у собранной, белое кольцо фокуса (049-Р47: золотое легло бы на синюю плитку) */
.kc { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 2px; min-width: 0; padding: 4px 3px 3px; border-radius: 10px; background: #1a1c45; border: 1.5px solid #2b2f72; font-size: 11px; line-height: 1.15; text-align: center; position: relative; }
.kc.full { border-color: #5fae7d; }
.kc.focus { outline: 3px solid #fff; outline-offset: 1px; }
.kc:focus-visible { outline: 3px solid #fff; outline-offset: 1px; }
.kc b { flex: none; display: flex; align-items: center; justify-content: center; min-height: 1.15em; max-width: 100%; font-size: 11px; line-height: 1.15; text-wrap: balance; }
.kc.none b { color: #9a9cab; }
.kc.prize { padding-inline: 1px; }
.kc.prize b { min-height: 2.3em; letter-spacing: -0.03em; color: var(--text); }
.kc.prize.none b { color: #b4b6c4; }
.kc small { color: var(--text-muted); }
.kc.prize small { flex: none; display: flex; align-items: flex-start; justify-content: center; min-height: 2.3em; max-width: 100%; font-size: 11px; color: var(--text); text-wrap: balance; }
/* фольга (049-Р21, collection-e-locker.css): ярлык на верхней кромке — шорты и плечо не закрывает; у собранной — серебряный кант и отлив фона; серебро, не золото (ТАБУ) */
.kc.foil.full { box-shadow: inset 0 0 0 2px #dfe5f3; background: linear-gradient(135deg, #262964, #1a1c45 38%, #1a1c45 62%, #3a4090); }
.foilt { position: absolute; top: -8px; right: 6px; z-index: 2; padding: 0 5px; border-radius: 6px; border: 1px solid #dfe5f3; background: #11132d; color: #dfe5f3; font-size: 12px; font-style: normal; font-weight: 700; line-height: 15px; }
.set, .pic { flex: none; display: flex; align-items: center; justify-content: center; }
.set { height: 58px; gap: 2px; }
.pic { height: 50px; }
.side { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.big :deep(.shirt) { height: 50px; width: auto; }
.sh :deep(.shirt) { height: 27px; width: auto; }
.so :deep(.shirt) { height: 29px; width: auto; }
.pic :deep(.shirt) { height: 50px; width: auto; }
/* нет части — тёмный силуэт без рисунка (Э2К.11: «???» ничего не выдаёт) */
.ghost { filter: brightness(0) invert(0.27) sepia(1) hue-rotate(190deg) saturate(2.2); }
.foot { flex: none; margin-top: auto; box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 100%; min-height: 36px; font-size: 11px; font-weight: 800; color: #e8e6fa; }
.foot.ok { color: #7fdca2; }
.kc.prize .foot { min-height: 24px; }
.kc :deep(button) { width: calc(100% + 10px); margin-inline: -5px; min-width: 0; padding: 2px; font-size: 11px; white-space: nowrap; }
.kc :deep(button:first-of-type) { margin-top: auto; }
.kc :deep(.kb-tag) { align-self: center; margin-top: auto; margin-bottom: 6px; }
</style>
