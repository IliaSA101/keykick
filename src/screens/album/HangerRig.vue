<script setup lang="ts">
/**
 * Оснастка вешалки в шкафчике (067 Т13 ш6, Э2К.11–21; порт `rodSvg`/`hookSvg`/`barSvg` макета): две штанги круглым деревом, крючок плечиков
 * проволокой, вешалка шорт с зажимами и свет на спрайтах (`TONE_FILTERS`). Всё в системе блока 160×440 (`hangerGeo.ts`): шейка плечиков — картинка `albumHanger`
 * с обрезкой. Слои: штанги и плечики — под вещами (z 1), вешалка шорт — над ними (z 3); вещи (z 2) кладёт родитель.
 * ТАБУ: только беж, коричневое и серая сталь — ни золота, ни жёлтого рядом с синими гетрами и шортами.
 */
import { artUrl } from '../../art/assets';
import { BAR, GRADS, HANGER, HG, ROD_INK, ROD_TOP, SHIFT, SHORTS, TONE_FILTERS, barOf, hookOf, rodOf } from './hangerGeo';

const props = defineProps<{ rodEnd: number }>();
const top = rodOf(ROD_TOP, props.rodEnd);
const low = rodOf(HG.rodY, props.rodEnd);
const hook = hookOf(ROD_TOP, 21 + SHIFT);
const hook2 = hookOf(HG.rodY, BAR.y + 0.5, SHORTS.l + SHORTS.w / 2);
const bar = barOf();
</script>

<template>
  <svg
    class="defs"
    width="0"
    height="0"
    aria-hidden="true"
  >
    <defs>
      <linearGradient
        v-for="g in GRADS"
        :id="g.id"
        :key="g.id"
        :gradientUnits="g.user ? 'userSpaceOnUse' : 'objectBoundingBox'"
        :x1="g.box[0]"
        :y1="g.box[1]"
        :x2="g.box[2]"
        :y2="g.box[3]"
      >
        <stop
          v-for="s in g.stops"
          :key="s.o"
          :offset="s.o"
          :stop-color="s.c"
          :stop-opacity="s.a ?? 1"
        />
      </linearGradient>
      <filter
        id="hgr-bl"
        x="-20%"
        y="-50%"
        width="140%"
        height="200%"
      >
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
      <filter
        id="hgr-bl2"
        x="-60%"
        y="-20%"
        width="220%"
        height="140%"
      >
        <feGaussianBlur stdDeviation=".7" />
      </filter>
      <filter
        v-for="f in TONE_FILTERS"
        :id="f.id"
        :key="f.id"
        x="0"
        y="0"
        width="1"
        height="1"
        primitiveUnits="objectBoundingBox"
        color-interpolation-filters="sRGB"
      >
        <feImage
          :href="f.uri"
          x="0"
          y="0"
          width="1"
          height="1"
          preserveAspectRatio="none"
          result="g"
        />
        <feComposite
          in="SourceGraphic"
          in2="g"
          operator="arithmetic"
          k1="1"
          k2="0"
          k3="0"
          k4="0"
        />
      </filter>
    </defs>
  </svg>
  <svg
    v-for="(r, n) in [top, low]"
    :key="n"
    class="rod"
    width="160"
    height="440"
    viewBox="0 0 160 440"
    aria-hidden="true"
  >
    <polygon
      :points="r.shadow"
      fill="#280e06"
      opacity=".38"
      filter="url(#hgr-bl)"
    />
    <ellipse
      :cx="r.x0 - 1.4"
      :cy="r.c + 1.6"
      rx="2.6"
      ry="6.4"
      fill="#280e06"
      opacity=".4"
      filter="url(#hgr-bl2)"
    />
    <ellipse
      :cx="r.x0"
      :cy="r.c"
      rx="2.7"
      ry="6.6"
      fill="#7c4322"
      :stroke="ROD_INK"
      stroke-width=".6"
    />
    <ellipse
      :cx="r.x0 + 0.7"
      :cy="r.c"
      rx="1.5"
      ry="5.4"
      fill="#b67a44"
    />
    <rect
      :x="r.x0"
      :y="r.y + r.h"
      :width="r.x1 - r.x0"
      height=".9"
      fill="#1e0a04"
      opacity=".35"
    />
    <rect
      :x="r.x0"
      :y="r.y"
      :width="r.x1 - r.x0"
      :height="r.h"
      fill="url(#hgr-cyl)"
    />
    <rect
      :x="r.x0 + 2"
      :y="r.y + 1.6"
      :width="r.x1 - r.x0 - 2"
      height=".9"
      rx=".45"
      fill="url(#hgr-spec)"
    />
    <rect
      :x="r.x0"
      :y="r.y"
      width="9"
      :height="r.h"
      fill="url(#hgr-ao)"
    />
    <rect
      :x="r.x1 - 4"
      :y="r.y"
      width="4"
      :height="r.h"
      fill="url(#hgr-aor)"
    />
    <line
      v-for="[yy, op] in r.lines"
      :key="yy"
      :x1="r.x0"
      :y1="yy"
      :x2="r.x1"
      :y2="yy"
      :stroke="ROD_INK"
      stroke-width=".6"
      :opacity="op"
    />
  </svg>
  <span class="item w1">
    <span
      class="part"
      :style="{ left: `${HANGER.l}px`, top: `${HANGER.t}px`, width: `${HANGER.w}px`, height: `${HANGER.h}px`, clipPath: HANGER.clip }"
    >
      <img
        :src="artUrl('albumHanger')"
        alt=""
      >
    </span>
    <svg
      class="wire"
      width="160"
      height="440"
      viewBox="0 0 160 440"
      fill="none"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <mask
        id="hgr-hm"
        maskUnits="userSpaceOnUse"
      >
        <rect
          x="0"
          y="0"
          width="160"
          height="440"
          fill="#fff"
        />
        <rect
          :x="hook.cx - 20"
          :y="hook.rodTop"
          width="20"
          :height="HG.rodH"
          fill="#000"
        />
      </mask>
      <g mask="url(#hgr-hm)">
        <path
          :d="hook.d"
          stroke="#3b2a24"
          stroke-opacity=".6"
          stroke-width="3.1"
        />
        <path
          :d="hook.d"
          stroke="url(#hgr-hw)"
          stroke-width="2.3"
        />
        <path
          :d="hook.d"
          stroke="#f1ebe5"
          stroke-opacity=".75"
          stroke-width=".6"
          transform="translate(.5 -.4)"
        />
      </g>
    </svg>
  </span>
  <span class="item w3">
    <svg
      class="wire"
      width="160"
      height="440"
      viewBox="0 0 160 440"
      fill="none"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <mask
        id="hgr-hm2"
        maskUnits="userSpaceOnUse"
      >
        <rect
          x="0"
          y="0"
          width="160"
          height="440"
          fill="#fff"
        />
        <rect
          :x="hook2.cx - 20"
          :y="hook2.rodTop"
          width="20"
          :height="HG.rodH"
          fill="#000"
        />
      </mask>
      <g mask="url(#hgr-hm2)">
        <path
          :d="hook2.d"
          stroke="#3b2a24"
          stroke-opacity=".6"
          stroke-width="3.1"
        />
        <path
          :d="hook2.d"
          stroke="url(#hgr-hw2)"
          stroke-width="2.3"
        />
        <path
          :d="hook2.d"
          stroke="#f1ebe5"
          stroke-opacity=".75"
          stroke-width=".6"
          transform="translate(.5 -.4)"
        />
      </g>
      <rect
        :x="bar.x0"
        :y="bar.y + 0.3"
        :width="bar.w"
        :height="bar.h"
        :rx="bar.h / 2"
        fill="#280e06"
        opacity=".35"
        filter="url(#hgr-bl2)"
      />
      <rect
        :x="bar.x0"
        :y="bar.y"
        :width="bar.w"
        :height="bar.h"
        :rx="bar.h / 2"
        fill="url(#hgr-st)"
        stroke="#3c1b12"
        stroke-width=".6"
      />
      <rect
        :x="bar.x0"
        :y="bar.y"
        :width="bar.w"
        :height="bar.h"
        :rx="bar.h / 2"
        fill="url(#hgr-stx)"
      />
      <rect
        :x="bar.x0 + 2"
        :y="bar.y + 0.9"
        :width="bar.w - 4"
        height=".7"
        rx=".35"
        fill="#f3d6b4"
        opacity=".6"
      />
      <g
        v-for="x in bar.clamps"
        :key="x"
      >
        <rect
          :x="x - 2.6"
          :y="bar.y + 1.4"
          width="5.2"
          :height="bar.h + 7"
          rx="1.1"
          fill="url(#hgr-cl)"
          stroke="#1c2329"
          stroke-width=".55"
        />
        <rect
          :x="x - 3.1"
          :y="bar.y + bar.h + 3.2"
          width="6.2"
          height="5"
          rx="1"
          fill="url(#hgr-cl)"
          stroke="#1c2329"
          stroke-width=".55"
        />
        <rect
          :x="x - 2.5"
          :y="bar.y + bar.h + 6.8"
          width="5"
          height=".7"
          fill="#1c2329"
          opacity=".7"
        />
        <circle
          :cx="x"
          :cy="bar.y + bar.h + 1.6"
          r=".7"
          fill="#c3ccd2"
          stroke="#1c2329"
          stroke-width=".3"
        />
        <rect
          :x="x + 1.4"
          :y="bar.y + bar.h - 0.2"
          width=".7"
          height="8.4"
          rx=".35"
          fill="#fff"
          opacity=".4"
        />
      </g>
    </svg>
  </span>
</template>

<style scoped>
.defs { position: absolute; width: 0; height: 0; }
.rod { position: absolute; left: 0; top: 0; display: block; overflow: visible; z-index: 1; pointer-events: none; }
.wire { position: absolute; left: 0; top: 0; display: block; overflow: visible; }
/* вещь: две тени на стенку вниз-влево от лампы (ближняя резкая, дальняя мягкая) — как `.ce-hg-w` макета */
.item { position: absolute; inset: 0; display: block; pointer-events: none; filter: drop-shadow(-2px 3px 1px rgb(40 14 6 / 0.5)) drop-shadow(-8px 12px 9px rgb(40 14 6 / 0.32)); }
.w1 { z-index: 1; }
.w3 { z-index: 3; }
.part { position: absolute; display: block; isolation: isolate; }
.part > img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
</style>
