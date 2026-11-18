/**
 * Звук: одно переключение на всю игру (кнопка шапки). Пока — в памяти вкладки: запись в `device.sound` появится с настройками
 * (шов сохранения для устройства экраны не пишут, 063-Р5), а звуки игры читают `soundOn`.
 */
import { ref } from 'vue';

export const soundOn = ref(true);

export function toggleSound(): void {
  soundOn.value = !soundOn.value;
}
