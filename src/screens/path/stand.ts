/** Состояние кадра Пути клуба для стенда (067 Т10): вид входа, доля отъезда и деление под мышью. В игре ключа нет. */
import type { InjectionKey } from 'vue';
import type { Via } from '../../engine/nav';

export interface PathStand {
  via?: Via;
  t?: number;
  hover?: string;
}

export const PATH_STAND: InjectionKey<() => PathStand> = Symbol('kk-path-stand');
