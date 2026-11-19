<script setup lang="ts">
/**
 * Строка тренера в карточке итога (068 Т8, Э6.38–Э6.42, ЭБ.27): лицо в круге и речь на кремовой бумаге — совет или «пальцы устали».
 * Только показ готового текста; стили — общие `.kb-result-coach` / `.kb-bub` (`styles/kit`). Подложка лица белая (ТАБУ: шарф на синем).
 */
import { artUrl } from '../../art/assets';
import { ru } from '../../i18n/ru';

withDefaults(defineProps<{ text: string; name?: string }>(), { name: ru.kit.coachName });
</script>

<template>
  <div class="kb-result-coach">
    <img
      class="ava"
      :src="artUrl('coachFace')"
      :alt="name"
    >
    <div class="kb-bub">
      <b class="nm">{{ name }}</b>
      <p>{{ text }}</p>
    </div>
  </div>
</template>
