import { createApp } from 'vue';
import App from './App.vue';
import { router } from './app/router';
import { watchViewport } from './app/viewport';
import './styles/tokens.css';

watchViewport();
createApp(App).use(router).mount('#app');
