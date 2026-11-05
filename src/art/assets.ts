/**
 * Готовая графика из public/art: ключ → путь от корня сайта.
 * Единственный источник путей к картинкам: тест tests/art.test.ts сверяет,
 * что каждый файл отсюда лежит на диске. Исходники генераций — в art-src (вне git).
 */
export const artFiles = {
  logo: 'art/logo.webp',
  menuBg: 'art/menu-bg.webp',
  // Экран матча: вид с точки пенальти на ворота; мяч — вырезан из логотипа.
  matchBg: 'art/match-bg.webp',
  // Фон внутренних экранов (клуб, шкафчик, пак, пенальти): раздевалка вечером, центр свободен.
  lockerBg: 'art/locker-bg.webp',
  ball: 'art/ball.webp',
  // Руки над клавиатурой, 1200×590, прозрачный фон; точки кончиков пальцев — в art/hands.ts.
  hands: 'art/hands.webp',
  // Значки игровых предметов, 256×256, прозрачный фон (docs/art-pipeline.md).
  iconCoin: 'art/icons/coin.webp',
  iconStar: 'art/icons/star.webp',
  iconTrophy: 'art/icons/trophy.webp',
  iconMedal: 'art/icons/medal.webp',
  iconWhistle: 'art/icons/whistle.webp',
  iconBoot: 'art/icons/boot.webp',
  iconGlove: 'art/icons/glove.webp',
  iconPack: 'art/icons/pack.webp',
  iconLock: 'art/icons/lock.webp',
  iconStopwatch: 'art/icons/stopwatch.webp',
  iconKey: 'art/icons/key.webp',
  iconShirt: 'art/icons/shirt.webp',
  // Кубки лиг на полке трофеев, 384×384, прозрачный фон (art-work/trophy, docs/art-pipeline.md).
  cupYard: 'art/trophy/cup-yard.webp',
  cupDistrict: 'art/trophy/cup-district.webp',
  cupCity: 'art/trophy/cup-city.webp',
  // Звуки матча (Magnific SFX, docs/art-pipeline.md); без файла играет синтез (app/sound).
  sfxKick: 'art/sfx/kick.mp3',
  sfxGoal: 'art/sfx/goal.mp3',
  sfxGroan: 'art/sfx/groan.mp3',
  sfxWhistleStart: 'art/sfx/whistle-start.mp3',
  sfxWhistleEnd: 'art/sfx/whistle-end.mp3',
  // Основа формы, 640×640, без потерь (tools/kit_layers.py): зоны и тени для перекраски.
  kitZones: 'art/kit/base-zones.webp',
  kitShade: 'art/kit/base-shade.webp',
  // Та же форма сзади: без выреза горловины, ровная спина под имя и номер.
  kitBackZones: 'art/kit/back-zones.webp',
  kitBackShade: 'art/kit/back-shade.webp',
  // Шорты, гетры, бутсы — те же два слоя со своими зонами (спека 004, docs/art-pipeline.md).
  shortsZones: 'art/kit/shorts-zones.webp',
  shortsShade: 'art/kit/shorts-shade.webp',
  socksZones: 'art/kit/socks-zones.webp',
  socksShade: 'art/kit/socks-shade.webp',
  bootsZones: 'art/kit/boots-zones.webp',
  bootsShade: 'art/kit/boots-shade.webp',
} as const;

export type ArtKey = keyof typeof artFiles;

/** Полный адрес с учётом подраздела /keykick/ на GitHub Pages. */
export function artUrl(key: ArtKey): string {
  return import.meta.env.BASE_URL + artFiles[key];
}
