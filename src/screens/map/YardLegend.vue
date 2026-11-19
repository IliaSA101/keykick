<script setup lang="ts">
/**
 * Легенда точек-уроков под окном уроков двора (Э2.11/.36): что значат белая точка, белый центр, квадрат и кольцо.
 * Стоит справа от портрета тренера; точки — те же `.pip`, что на ярлыках дворов.
 */
import { ru } from '../../i18n/ru';

const t = { ...ru.map.legend, cur: ru.map.today, fr: ru.map.friendly, ctl: ru.map.control };
</script>

<template>
  <div class="ylegend">
    <i class="pip done" />{{ t.done }} <i class="pip cur" />{{ t.cur }} <i class="pip fr" />{{ t.fr }} <i class="pip ctl" />{{ t.ctl }} <i class="pip ring" />{{ t.ring }}
  </div>
</template>

<style scoped>
.ylegend {
  position: absolute;
  left: 68px; /* справа от портрета тренера: белое кольцо портрета на легенду не заходит */
  bottom: 12px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 10px;
  font-size: 12px;
  background: rgb(18 18 46 / 0.85);
}
.ylegend .pip {
  margin-left: 6px;
}
/* образец «контрольный» — как .pip.ctl в kit: белое кольцо на синем, не золотое (ТАБУ 11.11) */
.ylegend .pip.ctl {
  background: var(--map-pip-next);
  box-shadow: 0 0 0 1.5px #fff;
}
</style>
