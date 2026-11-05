/// <reference types="vite/client" />

// Без этого объявления TypeScript не знает, что импорт *.vue — компонент.
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
