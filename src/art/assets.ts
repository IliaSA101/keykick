/**
 * Готовая графика из public/art: ключ → путь от корня сайта.
 * Единственный источник путей к картинкам: тест tests/art/art.test.ts сверяет,
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
  // Лицо тренера «молодой» для круга 48 px (050-Р53), 160×160 из art-work/coach/young-face.png: реплика тренера, строка итога.
  coachFace: 'art/coach/young-face.webp',
  // Портреты тренеров на белом для выбора при первом запуске (лист Э2К.34, 020-Т1), 480×640 из art-src/coach/<id>-1.png.
  coachPickYoung: 'art/coach/young-pick.webp',
  coachPickVeteran: 'art/coach/veteran-pick.webp',
  coachPickPonytail: 'art/coach/ponytail-pick.webp',
  coachPickBigbeard: 'art/coach/bigbeard-pick.webp',
  // Руки в позе печати над клавиатурой, 1600×748, прозрачный фон; точки кончиков пальцев — в art/hands.ts.
  hands: 'art/hands.webp',
  // Руки «как в кадре матча» (065-Р73, Э1.03): согнутые пальцы, две картинки 900×900; подгонка — components/keyboard/typingHands.ts.
  // Экран матча (065 Т9, Э1.03): фон-стадион 2752×1536 (макет Б, bg-b-7) и перчатка вратаря для «Вратарь отбил!».
  matchBgB: 'art/match/bg-b.webp',
  savedGlove: 'art/match/saved-glove.webp',
  handsTypingL:'art/hands-typing/hands-l.webp',
  handsTypingR: 'art/hands-typing/hands-r.webp',
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
  // Герб клуба — зелёно-белый щит с мячом, 128×152, прозрачный фон (docs/mockups/school/crest.png, 067 Т10): на флаге клуба в Пути.
  iconCrest: 'art/icons/crest.webp',
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
  // Пары бутс в Раздевалке (067 Т13, Э2К.11): кеды — вырезка из макета (docs/mockups/collection/img/kit/boots-basic.png, 330 px); «дворовые» и «коробка» — те же вырезки Лавки (shopBootsYard, shopBootsBox).
  bootsBasic: 'art/kit/boots-basic.webp',
  // Лавка (067 Т12, Э2К.01): вырезки вещей из кадров макета (tools/shop-cut/shop_cut.py), 520×274; бутсы — пара на прозрачном, 330 px.
  shopGateSticker: 'art/shop/gate-sticker.webp',
  shopCenterCircle: 'art/shop/center-circle.webp',
  shopSeatsClub: 'art/shop/seats-club.webp',
  shopNetFlags: 'art/shop/net-flags.webp',
  shopGraffiti: 'art/shop/graffiti.webp',
  shopDrum: 'art/shop/drum.webp',
  shopBanner: 'art/shop/banner.webp',
  shopGarland: 'art/shop/garland.webp',
  shopGoalAnim: 'art/shop/goal-anim.webp',
  shopYardWhole: 'art/shop/yard-whole.webp',
  shopBootsYard: 'art/shop/boots-yard.webp',
  shopBootsBox: 'art/shop/boots-box.webp',
  // Путь клуба (067 Т9, К-Ж): уровни лиг, облака, кубок мира; 1920 по ширине, webp q76 из docs/mockups/path/img.
  pathCity: 'art/path/city.webp',
  pathCloud1: 'art/path/cloud-1.webp',
  pathCloud2: 'art/path/cloud-2.webp',
  pathCloud3: 'art/path/cloud-3.webp',
  pathCloud4: 'art/path/cloud-4.webp',
  pathCloud5: 'art/path/cloud-5.webp',
  pathCloud6: 'art/path/cloud-6.webp',
  pathDistrict: 'art/path/district.webp',
  pathP2CountryEve: 'art/path/p2-country-eve.webp',
  pathP2EuropeEve: 'art/path/p2-europe-eve.webp',
  pathP3GlobeEve: 'art/path/p3-globe-eve.webp',
  pathPlaneA: 'art/path/plane-a.webp',
  pathWorldcup: 'art/path/worldcup.webp',
  // Альбом, пак, раздевалка, Музей (067 Т9): картинки макетов collection; слои kit-*-zones/shade — без потерь, как art/kit.
  albumCardBack: 'art/album/card-back.webp',
  albumCardFace: 'art/album/card-face.webp',
  albumCupYardGold: 'art/album/cup-yard-gold.webp',
  albumHanger: 'art/album/hanger.webp',
  albumKitHangShade: 'art/album/kit-hang-shade.webp',
  albumKitHangZones: 'art/album/kit-hang-zones.webp',
  albumKitShortsHangShade: 'art/album/kit-shorts-hang-shade.webp',
  albumKitShortsHangZones: 'art/album/kit-shorts-hang-zones.webp',
  albumKitSocksBarShade: 'art/album/kit-socks-bar-shade.webp',
  albumKitSocksBarZones: 'art/album/kit-socks-bar-zones.webp',
  albumLockerIn: 'art/album/locker-in.webp',
  albumMannequin: 'art/album/mannequin.webp',
  albumMedalSilver: 'art/album/medal-silver.webp',
  albumMuseumGold: 'art/album/museum-gold.webp',
  albumMuseumIn: 'art/album/museum-in.webp',
  albumPackClosed: 'art/album/pack-closed.webp',
  albumPackFoil: 'art/album/pack-foil.webp',
  albumPackOpen: 'art/album/pack-open.webp',
  albumPegFront: 'art/album/peg-front.webp',
  albumPlate: 'art/album/plate.webp',
  albumPlayer01: 'art/album/player-01.webp',
  albumPlayer02: 'art/album/player-02.webp',
  albumPlayer03: 'art/album/player-03.webp',
  albumPlayer04: 'art/album/player-04.webp',
  albumPlayer05: 'art/album/player-05.webp',
  albumPlayer06: 'art/album/player-06.webp',
  albumPlayer07: 'art/album/player-07.webp',
  albumPlayer08: 'art/album/player-08.webp',
  albumTvWhite: 'art/album/tv-white.webp',
  albumTvWood: 'art/album/tv-wood.webp',
  // Школа (067 Т9): медали тура, класс, эксперт.
  schoolClass: 'art/school/class.webp',
  schoolExpert: 'art/school/expert.webp',
  schoolMedalB: 'art/school/medal-b.webp',
  schoolMedalG: 'art/school/medal-g.webp',
  schoolMedalS: 'art/school/medal-s.webp',
  // Учебные игры и игры на интерес (067 Т9): значки игр, табло, ведомость, поле пар.
  learnArenaPairsBoard: 'art/learn/arena-pairs-board.webp',
  learnArenaScoreboard: 'art/learn/arena-scoreboard.webp',
  learnArenaSheetBoard: 'art/learn/arena-sheet-board.webp',
  learnIconKeyboardBuild: 'art/learn/icon-keyboard-build.webp',
  learnIconMatchSheet: 'art/learn/icon-match-sheet.webp',
  learnIconPairs: 'art/learn/icon-pairs.webp',
  learnIconPassArrows: 'art/learn/icon-pass-arrows.webp',
  learnIconPassMouse: 'art/learn/icon-pass-mouse.webp',
  learnIconScoreboard: 'art/learn/icon-scoreboard.webp',
  learnIconSquadPick: 'art/learn/icon-squad-pick.webp',
  learnIconTabDefenders: 'art/learn/icon-tab-defenders.webp',
  // База (067 Т9): фон, поле, кольцо, Саша, соперники, реквизит, судья, тренер в рост.
  baseBgBase: 'art/base/bg-base.webp',
  baseBgKeeper: 'art/base/bg-keeper.webp',
  baseBrkRivalFrontKit: 'art/base/brk-rival-front-kit.webp',
  baseBrkRivalFrontStripes: 'art/base/brk-rival-front-stripes.webp',
  baseBrkRivalFront: 'art/base/brk-rival-front.webp',
  baseBrkRivalShortsKit: 'art/base/brk-rival-shorts-kit.webp',
  baseBrkRivalShorts: 'art/base/brk-rival-shorts.webp',
  baseBrkRivalSocksKit: 'art/base/brk-rival-socks-kit.webp',
  baseBrkRivalSocks: 'art/base/brk-rival-socks.webp',
  baseCoachYoungFull: 'art/base/coach-young-full.webp',
  baseFieldAll: 'art/base/field-all.webp',
  baseFieldBare: 'art/base/field-bare.webp',
  baseFieldGoalsGold: 'art/base/field-goals-gold.webp',
  baseFieldGoals: 'art/base/field-goals.webp',
  baseFieldPatch: 'art/base/field-patch.webp',
  baseFieldWorn: 'art/base/field-worn.webp',
  baseKeeperDiveKit: 'art/base/keeper-dive-kit.webp',
  baseKeeperDive: 'art/base/keeper-dive.webp',
  baseKeeperJoyKit: 'art/base/keeper-joy-kit.webp',
  baseKeeperJoy: 'art/base/keeper-joy.webp',
  baseKeeperReadyKit: 'art/base/keeper-ready-kit.webp',
  baseKeeperReady: 'art/base/keeper-ready.webp',
  basePropsBallCart: 'art/base/props-ball-cart.webp',
  basePropsCones: 'art/base/props-cones.webp',
  basePropsCornerTarget: 'art/base/props-corner-target.webp',
  basePropsMannequin: 'art/base/props-mannequin.webp',
  basePropsScoreboardStand: 'art/base/props-scoreboard-stand.webp',
  basePropsTargetRing: 'art/base/props-target-ring.webp',
  baseRefereeClipboard: 'art/base/referee-clipboard.webp',
  baseRefereeHead: 'art/base/referee-head.webp',
  baseRefereeStand: 'art/base/referee-stand.webp',
  baseRefereeThumbsUp: 'art/base/referee-thumbs-up.webp',
  baseRefereeWhistlePoint: 'art/base/referee-whistle-point.webp',
  baseRingBenches: 'art/base/ring-benches.webp',
  baseRingBoard: 'art/base/ring-board.webp',
  baseRingFence: 'art/base/ring-fence.webp',
  baseRingFlags: 'art/base/ring-flags.webp',
  baseRingLights: 'art/base/ring-lights.webp',
  baseRingStand: 'art/base/ring-stand.webp',
  baseRingStands: 'art/base/ring-stands.webp',
  baseRivalKickKit: 'art/base/rival-kick-kit.webp',
  baseRivalKick: 'art/base/rival-kick.webp',
  baseRivalRun2Kit: 'art/base/rival-run-2-kit.webp',
  baseRivalRun2: 'art/base/rival-run-2.webp',
  baseRivalRunKit: 'art/base/rival-run-kit.webp',
  baseRivalRun: 'art/base/rival-run.webp',
  baseRivalWallCover2Kit: 'art/base/rival-wall-cover-2-kit.webp',
  baseRivalWallCover2: 'art/base/rival-wall-cover-2.webp',
  baseRivalWallCoverKit: 'art/base/rival-wall-cover-kit.webp',
  baseRivalWallCover: 'art/base/rival-wall-cover.webp',
  baseRivalWallCross2Kit: 'art/base/rival-wall-cross-2-kit.webp',
  baseRivalWallCross2: 'art/base/rival-wall-cross-2.webp',
  baseRivalWallCrossKit: 'art/base/rival-wall-cross-kit.webp',
  baseRivalWallCross: 'art/base/rival-wall-cross.webp',
  baseRivalWallFlinchKit: 'art/base/rival-wall-flinch-kit.webp',
  baseRivalWallFlinch: 'art/base/rival-wall-flinch.webp',
  baseRivalWallStand2Kit: 'art/base/rival-wall-stand-2-kit.webp',
  baseRivalWallStand2: 'art/base/rival-wall-stand-2.webp',
  baseRivalWallStandKit: 'art/base/rival-wall-stand-kit.webp',
  baseRivalWallStand: 'art/base/rival-wall-stand.webp',
  baseSashaDrop: 'art/base/sasha-drop.webp',
  baseSashaHead2: 'art/base/sasha-head-2.webp',
  baseSashaHead: 'art/base/sasha-head.webp',
  baseSashaInstep: 'art/base/sasha-instep.webp',
  baseSashaJoy1: 'art/base/sasha-joy-1.webp',
  baseSashaJoy: 'art/base/sasha-joy.webp',
  baseSashaKick: 'art/base/sasha-kick.webp',
  baseSashaKnee2: 'art/base/sasha-knee-2.webp',
  baseSashaKnee: 'art/base/sasha-knee.webp',
  baseSashaRun2: 'art/base/sasha-run-2.webp',
  baseSashaRun: 'art/base/sasha-run.webp',
  baseSashaStand: 'art/base/sasha-stand.webp',
} as const;

export type ArtKey = keyof typeof artFiles;

/**
 * Путь клуба во Дворе (К-Ж): сразу — только уровень 1 (map/base Карты), облака и кубок мира;
 * уровни 2–6 и самолёт грузятся лениво, когда колёсико упирается в этап Э1.
 */
export const artPathEager: readonly ArtKey[] = [
  'pathCloud1', 'pathCloud2', 'pathCloud3', 'pathCloud4', 'pathCloud5', 'pathCloud6', 'pathWorldcup',
];
export const artPathLazy: readonly ArtKey[] = [
  'pathDistrict', 'pathCity', 'pathP2CountryEve', 'pathP2EuropeEve', 'pathP3GlobeEve', 'pathPlaneA',
];

/**
 * Графика экрана при первом открытии: что экран просит у сети сам, помимо общего каркаса (шапка, значки).
 * Один список на экран — для двух потребителей: тест веса (tests/art: экран ≤ 1,5 МБ, решение владельца 19.11,
 * журнал «вес и качество графики: предел по экранам, не по папкам») и фоновая догрузка соседних экранов
 * (067 Т23: пока ребёнок на экране А, браузер лениво подтягивает `screenArt` экранов, куда он попадёт отсюда).
 * Новая картинка в экране — ключ сюда же, иначе тест веса её не увидит, а догрузка не подготовит.
 * Для Пути своя пара `artPathEager`/`artPathLazy`, для Дома — манифест `src/content/home-art.json` (слои печи).
 */
export type ScreenArtId = 'base' | 'keepy' | 'memo' | 'mini' | 'keeper' | 'free' | 'school' | 'locker' | 'museum' | 'shop' | 'pack' | 'match' | 'club' | 'learn';
export const screenArt: Record<ScreenArtId, readonly ArtKey[]> = {
  // База: фон, поле карточек игр (две ступени: «вытертое» до урока 6, дальше с воротами), Саша и майка на карточках.
  base: ['baseBgBase', 'baseFieldWorn', 'baseFieldGoals', 'baseSashaKnee', 'baseSashaKick', 'iconShirt'],
  // Чеканка: фон Базы и пять поз Саши.
  keepy: ['baseBgBase', 'baseSashaStand', 'baseSashaKnee', 'baseSashaKnee2', 'baseSashaJoy', 'baseSashaJoy1'],
  // Мемори: фон Базы и слои формы (перекраска майки в ShirtView).
  memo: ['baseBgBase', 'kitZones', 'kitShade'],
  // Мини-футбол: слои поля по ступеням (основа газона, вещи кольца, золото ворот) — всё сразу: ступень растёт от урока к уроку.
  mini: [
    'baseFieldBare', 'baseFieldWorn', 'baseFieldPatch', 'baseFieldGoals', 'baseFieldGoalsGold', 'baseRingBenches', 'baseRingFence',
    'baseRingStands', 'baseRingBoard', 'baseRingLights', 'baseRingFlags', 'baseRingStand',
  ],
  // Вратарь: свой фон, три позы вратаря и две позы бьющего (рисунок и маска формы), Саша на ленте.
  keeper: [
    'baseBgKeeper', 'baseKeeperReady', 'baseKeeperReadyKit', 'baseKeeperDive', 'baseKeeperDiveKit',
    'baseKeeperJoy', 'baseKeeperJoyKit', 'baseRivalRun', 'baseRivalRunKit', 'baseRivalKick', 'baseRivalKickKit',
    'baseSashaKnee2',
  ],
  // Штрафной: арена матча, три позы Саши (рисунок), четыре игрока стенки (рисунок и маска формы), мяч — вырезка из Саши.
  free: [
    'matchBgB', 'baseSashaRun', 'baseSashaKick', 'baseSashaJoy', 'baseSashaKnee2',
    'baseRivalWallCover', 'baseRivalWallCoverKit', 'baseRivalWallCross2', 'baseRivalWallCross2Kit',
    'baseRivalWallCross', 'baseRivalWallCrossKit', 'baseRivalWallStand', 'baseRivalWallStandKit',
  ],
  // Школа и экраны тура: класс (фон), тренер, эксперт, герб и три медали.
  school: ['schoolClass', 'coachFace', 'schoolExpert', 'iconCrest', 'schoolMedalB', 'schoolMedalG', 'schoolMedalS'],
  // Раздевалка: шкафчик, вешалка, табличка, три вида формы на вешалке и три пары бутс.
  locker: [
    'albumLockerIn', 'albumHanger', 'albumPlate', 'albumKitHangZones', 'albumKitHangShade', 'albumKitShortsHangZones',
    'albumKitShortsHangShade', 'albumKitSocksBarZones', 'albumKitSocksBarShade', 'bootsBasic', 'shopBootsYard', 'shopBootsBox',
    // Форма на карточке (`ShirtView` в `LockerCard`): слои майки, шорт и гетр.
    'kitZones', 'kitShade', 'shortsZones', 'shortsShade', 'socksZones', 'socksShade',
  ],
  museum: ['albumMuseumIn', 'albumCupYardGold', 'albumTvWhite'],
  // Лавка: вырезки всех вещей и бутс.
  shop: [
    'shopGateSticker', 'shopCenterCircle', 'shopSeatsClub', 'shopNetFlags', 'shopGraffiti', 'shopDrum', 'shopBanner',
    'shopGarland', 'shopGoalAnim', 'shopYardWhole', 'shopBootsYard', 'shopBootsBox',
  ],
  // Пак: фон матча, пак закрытый, открытый и в фольге, карточки, восемь игроков, слои майки.
  pack: [
    'matchBg', 'albumPackClosed', 'albumPackOpen', 'albumPackFoil', 'albumCardBack', 'albumCardFace', 'albumPlayer01',
    'albumPlayer02', 'albumPlayer03', 'albumPlayer04', 'albumPlayer05', 'albumPlayer06', 'albumPlayer07', 'albumPlayer08',
    'kitZones', 'kitShade',
  ],
  // Матч: стадион, перчатка, мяч, руки в позе печати, слои формы (майка, спина, шорты, гетры).
  match: [
    'matchBgB', 'savedGlove', 'ball', 'handsTypingL', 'handsTypingR', 'kitZones', 'kitShade', 'kitBackZones', 'kitBackShade',
    'shortsZones', 'shortsShade', 'socksZones', 'socksShade',
  ],
  // Клуб: портреты четырёх тренеров и слои формы.
  club: [
    'coachPickYoung', 'coachPickVeteran', 'coachPickPonytail', 'coachPickBigbeard', 'kitZones', 'kitShade', 'kitBackZones',
    'kitBackShade', 'shortsZones', 'shortsShade', 'socksZones', 'socksShade',
  ],
  // Учебные игры: поле, три арены, восемь значков, судья, тренер.
  learn: [
    'baseFieldGoals', 'learnArenaPairsBoard', 'learnArenaScoreboard', 'learnArenaSheetBoard', 'learnIconKeyboardBuild',
    'learnIconMatchSheet', 'learnIconPairs', 'learnIconPassArrows', 'learnIconPassMouse', 'learnIconScoreboard',
    'learnIconSquadPick', 'learnIconTabDefenders', 'baseRefereeThumbsUp', 'baseRefereeHead', 'coachFace',
  ],
};

/**
 * Фоны на весь экран: тест качества (tests/art) требует ширину ≥ 1920 px и кодек не хуже q76 (решение владельца 19.11:
 * «не пережимать ради веса»). Основы Дома и Карты (`art/home/base-N`, `art/map/base`) тест берёт из манифеста печи.
 */
export const artBackgrounds: readonly ArtKey[] = [
  'menuBg', 'matchBg', 'matchBgB', 'lockerBg', 'baseBgBase', 'baseBgKeeper', 'baseFieldAll', 'baseFieldBare',
  'baseFieldGoals', 'baseFieldWorn', 'baseFieldPatch', 'albumLockerIn', 'albumMuseumIn', 'albumMuseumGold', 'schoolClass',
  'pathCity', 'pathDistrict', 'pathP2CountryEve', 'pathP2EuropeEve', 'pathP3GlobeEve',
];

/** Полный адрес с учётом подраздела /keykick/ на GitHub Pages. */
export function artUrl(key: ArtKey): string {
  return import.meta.env.BASE_URL + artFiles[key];
}
