/// <reference types="vite/client" />

// Без этого объявления TypeScript не знает, что импорт *.vue — компонент.
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface ImportMetaEnv {
  /** Канал сборки: release — выпуск меток v2+ (задаёт tools/build-site.mjs); нет или иное — next. */
  readonly VITE_KK_CHANNEL?: string;
}
