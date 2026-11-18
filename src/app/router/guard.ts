/**
 * Охрана входа на переходе (063 design §1): спрашивает чистую `enter` и выполняет ответ.
 * Адреса `/dev/*` (лист сверки, только в разработке) охране не подчиняются. `help` и `pack` экранов пока не имеют
 * (окна — Т11, `usePack` — Т5): вход есть, плашку рисует оболочка по `status`. `phone` — «телефон без клавиатуры»
 * (`app/phone/device.ts`): тогда сохранение не читается совсем.
 */
import { enter, type EntryInput } from '../../engine/players/entry';

export interface EntrySource {
  entryState(): Pick<EntryInput, 'device' | 'players' | 'tabPid' | 'player'>;
  choose(pid: string): Promise<void>;
}

/** `true` — пускаем; строка — перенаправление (адрес без `#`); `false` — переход отменён (идёт окно сбоя). */
export async function guardRoute(to: { path: string; fullPath: string }, src: EntrySource, crashed: () => boolean, phone: () => boolean = () => false): Promise<boolean | string> {
  if (to.path.startsWith('/dev/')) return true;
  // выбор единственного игрока меняет состояние — спрашиваем заново; больше трёх кругов не бывает
  for (let round = 0; round < 3; round++) {
    const isPhone = phone();
    // на телефоне хранилище не читаем: `enter` отвечает до сохранения, заглушка нужна только типу
    const state = isPhone ? { device: 'absent' as const, players: [], tabPid: undefined, player: 'none' as const } : src.entryState();
    const answer = enter({ ...state, pack: 'ok', route: `#${to.fullPath}`, crash: crashed(), phone: isPhone });
    switch (answer.kind) {
      case 'stay':
      case 'help':
      case 'pack':
        return true;
      case 'crash':
        return false;
      case 'go':
        return answer.to.replace(/^#/, '');
      case 'choose':
        await src.choose(answer.pid);
    }
  }
  return true;
}
