// src/config/gameData.ts
import { WeatherType, SpecialEventType, LocationId } from '@/types/game';

export const MONSTERS = {
  // Starter Island (Level 1-5)
  'sea_beast_small': { name: '🦑 Baby Sea King', level: 1, hp: 50, attack: 5, defense: 3, exp: 20, drops: ['fish_small', 'sea_crystal'] },
  'bandit_weak': { name: '👤 Bandit Lemah', level: 1, hp: 45, attack: 6, defense: 2, exp: 15, drops: ['wooden_sword', 'bandage'] },
  'wild_monkey': { name: '🐒 Monyet Liar', level: 2, hp: 60, attack: 7, defense: 4, exp: 25, drops: ['banana', 'monkey_fur'] },
  'angry_boar': { name: '🐗 Babi Hutan', level: 2, hp: 70, attack: 8, defense: 5, exp: 30, drops: ['meat_raw', 'boar_tusk'] },
  'pirate_rookie': { name: '🏴‍☠️ Bajak Laut Pemula', level: 3, hp: 80, attack: 10, defense: 6, exp: 35, drops: ['pirate_coin', 'rum'] },

  // Shell Town (Level 5-10)
  'marine_trainee': { name: '👮 Marinir Pelatih', level: 5, hp: 100, attack: 12, defense: 8, exp: 45, drops: ['marine_badge', 'training_manual'] },
  'axe_hand': { name: '🪓 Tangan Kapak', level: 6, hp: 120, attack: 15, defense: 10, exp: 50, drops: ['steel_axe', 'iron_plate'] },
  'corrupt_marine': { name: '🦹‍♂️ Marinir Korup', level: 7, hp: 130, attack: 16, defense: 12, exp: 55, drops: ['bribe_money', 'corrupt_badge'] },
  'helmeppo': { name: '👑 Helmeppo', level: 8, hp: 150, attack: 18, defense: 15, exp: 70, drops: ['golden_sword', 'fancy_clothes'] },
  'morgan': { name: '💀 Kapten Morgan', level: 10, hp: 200, attack: 25, defense: 20, exp: 100, drops: ['morgan_axe', 'captain_coat'] },

  // Orange Town (Level 10-15)
  'buggy_pirate': { name: '🤡 Anak Buah Buggy', level: 10, hp: 160, attack: 20, defense: 15, exp: 75, drops: ['circus_knife', 'red_nose'] },
  'mohji_richie': { name: '🦁 Mohji & Richie', level: 12, hp: 180, attack: 22, defense: 18, exp: 85, drops: ['lion_fang', 'beast_tamer_whip'] },
  'cabaji': { name: '🎪 Cabaji', level: 13, hp: 190, attack: 23, defense: 19, exp: 90, drops: ['acrobat_sword', 'unicycle'] },
  'buggy': { name: '🃏 Buggy si Badut', level: 15, hp: 250, attack: 30, defense: 25, exp: 120, drops: ['bara_bara_fruit', 'buggy_cape'] },

  // Syrup Village (Level 15-20)
  'black_cat_pirate': { name: '🐱‍👤 Bajak Laut Kucing Hitam', level: 15, hp: 200, attack: 25, defense: 20, exp: 95, drops: ['cat_claw', 'black_flag'] },
  'sham': { name: '😺 Sham', level: 16, hp: 210, attack: 26, defense: 21, exp: 100, drops: ['cat_bell', 'stealth_boots'] },
  'buchi': { name: '😾 Buchi', level: 16, hp: 220, attack: 27, defense: 22, exp: 100, drops: ['heavy_paw', 'cat_armor'] },
  'jango': { name: '🎩 Jango', level: 17, hp: 230, attack: 28, defense: 23, exp: 110, drops: ['hypno_ring', 'chakram'] },
  'kuro': { name: '👓 Kuro', level: 20, hp: 300, attack: 35, defense: 30, exp: 150, drops: ['cat_claws', 'kuro_glasses'] },

  // Baratie (Level 20-25)
  'cook_pirate': { name: '👨‍🍳 Bajak Laut Koki', level: 20, hp: 250, attack: 30, defense: 25, exp: 120, drops: ['kitchen_knife', 'spice_set'] },

  // Loguetown (Level 25-30)
  'street_thug': { name: '🦹 Preman Jalanan', level: 25, hp: 280, attack: 32, defense: 28, exp: 130, drops: ['brass_knuckles', 'leather_jacket'] },
  'corrupt_merchant': { name: '🤑 Pedagang Licik', level: 26, hp: 290, attack: 33, defense: 29, exp: 135, drops: ['fake_berry', 'merchant_list'] },
  'bounty_hunter': { name: '🎯 Pemburu Hadiah', level: 27, hp: 300, attack: 35, defense: 30, exp: 140, drops: ['wanted_poster', 'hunter_badge'] },
  'smoker': { name: '💨 Kapten Smoker', level: 30, hp: 400, attack: 45, defense: 40, exp: 200, drops: ['smoke_fruit', 'justice_coat'] },

  // Arlong Park (Level 30-35)
  'fishman_grunt': { name: '🐟 Anak Buah Arlong', level: 30, hp: 350, attack: 40, defense: 35, exp: 160, drops: ['fish_scale', 'water_pearl'] },
  'chu': { name: '💦 Chu', level: 31, hp: 360, attack: 42, defense: 36, exp: 165, drops: ['water_gun', 'fish_teeth'] },
  'kuroobi': { name: '🥋 Kuroobi', level: 32, hp: 370, attack: 44, defense: 38, exp: 170, drops: ['karate_gi', 'ray_fin'] },
  'hatchan': { name: '🐙 Hatchan', level: 33, hp: 380, attack: 46, defense: 40, exp: 175, drops: ['six_swords', 'takoyaki'] },
  'arlong': { name: '🦈 Arlong', level: 35, hp: 500, attack: 55, defense: 50, exp: 250, drops: ['saw_nose', 'shark_tooth'] },

  // Drum Island (Level 35-40)
  'snow_beast': { name: '❄️ Binatang Salju', level: 35, hp: 400, attack: 48, defense: 42, exp: 180, drops: ['winter_fur', 'ice_crystal'] },
  'lapahn': { name: '🐰 Lapahn', level: 36, hp: 410, attack: 50, defense: 44, exp: 185, drops: ['rabbit_meat', 'snow_boots'] },
  'wapol_soldier': { name: '🤖 Tentara Wapol', level: 37, hp: 420, attack: 52, defense: 46, exp: 190, drops: ['metal_piece', 'tin_plate'] },
  'chess': { name: '♟️ Chess', level: 38, hp: 430, attack: 54, defense: 48, exp: 195, drops: ['chess_piece', 'strategy_book'] },
  'wapol': { name: '🤴 Wapol', level: 40, hp: 600, attack: 65, defense: 60, exp: 300, drops: ['munch_fruit', 'crown'] }
};

export const ITEMS = {
  // Healing Items
  'potion': { name: '🧪 Potion', type: 'HEAL', value: 50, description: '❤️ Memulihkan 50 HP', price: 100 },
  'super_potion': { name: '🔮 Super Potion', type: 'HEAL', value: 100, description: '❤️ Memulihkan 100 HP', price: 200 },
  'bandage': { name: '🩹 Perban', type: 'HEAL', value: 30, description: '❤️ Memulihkan 30 HP', price: 50 },
  'meat_cooked': { name: '🍖 Daging Panggang', type: 'HEAL', value: 80, description: '❤️ Memulihkan 80 HP', price: 150 },
  'sanji_special': { name: '👨‍🍳 Masakan Spesial Sanji', type: 'HEAL', value: 200, description: '❤️ Memulihkan 200 HP', price: 500 },

  // Buff Items
  'attack_boost': { name: '⚔️ Attack Boost', type: 'BUFF', value: 5, description: '💪 ATK +5 selama pertarungan', price: 300 },
  'defense_boost': { name: '🛡️ Defense Boost', type: 'BUFF', value: 5, description: '🛡️ DEF +5 selama pertarungan', price: 300 },
  'speed_boost': { name: '💨 Speed Boost', type: 'BUFF', value: 5, description: '🏃 SPD +5 selama pertarungan', price: 300 },
  'all_boost': { name: '🌟 All Stats Boost', type: 'BUFF', value: 3, description: '💫 Semua stats +3 selama pertarungan', price: 500 },

  // Weapons
  'wooden_sword': { name: '🗡️ Pedang Kayu', type: 'WEAPON', attack: 5, description: '⚔️ Pedang latihan basic', price: 100 },
  'steel_sword': { name: '⚔️ Pedang Baja', type: 'WEAPON', attack: 10, description: '⚔️ Pedang standar marinir', price: 300 },
  'wado_ichimonji': { name: '🗡️ Wado Ichimonji', type: 'WEAPON', attack: 25, description: '⚔️ Pedang legendaris Zoro', price: 1000 },
  'kitchen_knife': { name: '🔪 Pisau Dapur', type: 'WEAPON', attack: 8, description: '⚔️ Senjata khas koki Baratie', price: 200 },
  'slingshot': { name: '🎯 Ketapel', type: 'WEAPON', attack: 7, description: '🎯 Senjata andalan Usopp', price: 150 },

  // Armor
  'straw_hat': { name: '🎩 Topi Jerami', type: 'ARMOR', defense: 5, description: '🛡️ Topi legendaris Luffy', price: 1000 },
  'marine_coat': { name: '🧥 Jubah Marinir', type: 'ARMOR', defense: 8, description: '🛡️ Seragam standar marinir', price: 300 },
  'pirate_armor': { name: '👕 Baju Bajak Laut', type: 'ARMOR', defense: 7, description: '🛡️ Pakaian bajak laut', price: 250 },
  'chef_outfit': { name: '👨‍🍳 Seragam Koki', type: 'ARMOR', defense: 6, description: '🛡️ Seragam koki Baratie', price: 200 },

  // Materials & Quest Items
  'sea_crystal': { name: '💎 Kristal Laut', type: 'MATERIAL', description: '✨ Kristal langka dari dasar laut', price: 500 },
  'pirate_coin': { name: '💰 Koin Bajak Laut', type: 'MATERIAL', description: '💰 Mata uang bajak laut', price: 100 },

  // Additional Healing Items
  'rumble_ball': { name: '💊 Rumble Ball', type: 'HEAL', value: 150, description: '❤️ Memulihkan 150 HP dan memberikan buff', price: 400 },
  'doctor_tony': { name: '🦌 Ramuan Dr. Tony', type: 'HEAL', value: 120, description: '❤️ Memulihkan 120 HP dan menghilangkan status buruk', price: 350 },
  'meat_raw': { name: '🥩 Daging Mentah', type: 'MATERIAL', description: '🍖 Bahan makanan mentah', price: 50 },
  'fish_fresh': { name: '🐟 Ikan Segar', type: 'MATERIAL', description: '🍣 Bahan makanan laut', price: 40 },
  'herbs': { name: '🌿 Herbal', type: 'MATERIAL', description: '💊 Bahan ramuan obat', price: 30 },

  // Additional Weapons
  'three_sword': { name: '⚔️ Three Sword Style', type: 'WEAPON', attack: 30, description: '⚔️ Set pedang lengkap Zoro', price: 2000 },
  'clima_tact': { name: '🌪️ Clima Tact', type: 'WEAPON', attack: 15, description: '🌡️ Senjata pengendali cuaca', price: 800 },
  'impact_dial': { name: '🌊 Impact Dial', type: 'WEAPON', attack: 20, description: '💥 Menyerap dan melepaskan dampak', price: 600 },
  'shark_sword': { name: '🦈 Kiribachi', type: 'WEAPON', attack: 28, description: '⚔️ Pedang gergaji Arlong', price: 1500 },
  'smoke_jitte': { name: '💨 Jitte Asap', type: 'WEAPON', attack: 25, description: '⚔️ Senjata Kapten Smoker', price: 1200 },

  // Additional Armor
  'dojo_gi': { name: '🥋 Seragam Dojo', type: 'ARMOR', defense: 10, description: '🛡️ Pakaian latihan', price: 400 },
  'snow_coat': { name: '🧥 Mantel Salju', type: 'ARMOR', defense: 12, description: '🛡️ Melindungi dari dingin', price: 500 },
  'fishman_suit': { name: '🏊 Baju Renang', type: 'ARMOR', defense: 11, description: '🛡️ Cocok untuk pertarungan air', price: 450 },
  'metal_armor': { name: '🛡️ Armor Logam', type: 'ARMOR', defense: 15, description: '🛡️ Pelindung berat', price: 800 },

  // Additional Materials
  'adam_wood': { name: '🌳 Kayu Adam', type: 'MATERIAL', description: '✨ Kayu legendaris', price: 2000 },
  'sea_stone': { name: '💠 Batu Laut', type: 'MATERIAL', description: '✨ Melemahkan pengguna buah iblis', price: 1500 },
  'cola': { name: '🥤 Cola', type: 'MATERIAL', description: '⚡ Sumber energi', price: 50 },
  'treasure_map': { name: '🗺️ Peta Harta Karun', type: 'MATERIAL', description: '💰 Menunjukkan lokasi harta', price: 1000 },
  'den_den_mushi': { name: '🐌 Den Den Mushi', type: 'MATERIAL', description: '📞 Siput komunikasi', price: 300 }
};

export const QUESTS = {
  // Luffy's Quests
  "luffy_training_1": {
    name: "🥊 Latihan Dasar Luffy",
    description: "Kalahkan 5 monster di Starter Island",
    reward: 100,
    requiredLevel: 1,
    mentor: "YB",
    type: "COMBAT"
  },
  "find_meat_quest": {
    name: "🍖 Mencari Daging",
    description: "Kumpulkan 3 daging dari babi hutan",
    reward: 150,
    requiredLevel: 2,
    mentor: "YB",
    type: "GATHERING"
  },
  "gear_second_training": {
    name: "⚡ Latihan Gear Second",
    description: "Capai 5 combo dalam pertarungan",
    reward: 200,
    requiredLevel: 5,
    mentor: "YB",
    type: "COMBAT"
  },

  // Zoro's Quests
  "zoro_training_1": {
    name: "⚔️ Latihan Pedang Dasar",
    description: "Kalahkan 3 marinir di Shell Town",
    reward: 120,
    requiredLevel: 3,
    mentor: "Tierison",
    type: "COMBAT"
  },
  "find_swords": {
    name: "🗡️ Mencari Pedang",
    description: "Temukan pedang legendaris di Shell Town",
    reward: 180,
    requiredLevel: 4,
    mentor: "Tierison",
    type: "EXPLORATION"
  },

  // Usopp's Quests
  "usopp_training_1": {
    name: "🎯 Latihan Menembak",
    description: "Capai 5 critical hit dengan ketapel",
    reward: 130,
    requiredLevel: 2,
    mentor: "LYuka",
    type: "COMBAT"
  },
  "protect_village": {
    name: "🏠 Lindungi Desa",
    description: "Kalahkan bajak laut kucing hitam",
    reward: 160,
    requiredLevel: 4,
    mentor: "LYuka",
    type: "COMBAT"
  },

  // Sanji's Quests
  "sanji_training_1": {
    name: "👨‍🍳 Latihan Memasak",
    description: "Buat 3 hidangan dengan bahan segar",
    reward: 140,
    requiredLevel: 2,
    mentor: "GarryAng",
    type: "CRAFTING"
  },
  "baratie_defense": {
    name: "🏰 Pertahanan Baratie",
    description: "Kalahkan bajak laut yang menyerang Baratie",
    reward: 170,
    requiredLevel: 5,
    mentor: "GarryAng",
    type: "COMBAT"
  },

  // Additional Luffy's Quests
  "luffy_rescue": {
    name: "💪 Misi Penyelamatan",
    description: "Selamatkan teman dari marinir",
    reward: 250,
    requiredLevel: 8,
    mentor: "YB",
    type: "COMBAT"
  },
  "pirate_king_dream": {
    name: "👑 Impian Raja Bajak Laut",
    description: "Kalahkan 10 kapten bajak laut",
    reward: 500,
    requiredLevel: 15,
    mentor: "YB",
    type: "COMBAT"
  },

  // Additional Zoro's Quests
  "sword_master": {
    name: "⚔️ Jalan Pedang",
    description: "Kumpulkan 3 pedang legendaris",
    reward: 400,
    requiredLevel: 12,
    mentor: "Tierison",
    type: "GATHERING"
  },
  "lost_navigation": {
    name: "🗺️ Tersesat Lagi",
    description: "Bantu Zoro menemukan jalan pulang",
    reward: 300,
    requiredLevel: 10,
    mentor: "Tierison",
    type: "EXPLORATION"
  },

  // Additional Usopp's Quests
  "sniper_king": {
    name: "🎯 Raja Penembak Jitu",
    description: "Tembak 10 target dari jarak jauh",
    reward: 350,
    requiredLevel: 10,
    mentor: "LYuka",
    type: "COMBAT"
  },
  "brave_warrior": {
    name: "🦸‍♂️ Prajurit Pemberani",
    description: "Hadapi ketakutanmu",
    reward: 280,
    requiredLevel: 8,
    mentor: "LYuka",
    type: "EXPLORATION"
  },

  // Additional Sanji's Quests
  "ultimate_recipe": {
    name: "👨‍🍳 Resep Legendaris",
    description: "Temukan bahan langka dan buat hidangan spesial",
    reward: 450,
    requiredLevel: 15,
    mentor: "GarryAng",
    type: "CRAFTING"
  },
  "ladies_first": {
    name: "🌹 Ladies First",
    description: "Bantu 5 karakter wanita dalam kesulitan",
    reward: 320,
    requiredLevel: 10,
    mentor: "GarryAng",
    type: "HELP"
  }
};

export const LOCATIONS = {
  'starter_island': {
    name: '🏝️ Starter Island',
    description: 'Pulau pertama dalam petualanganmu',
    level: 1,
    monsters: ['sea_beast_small', 'bandit_weak', 'wild_monkey', 'angry_boar', 'pirate_rookie'],
    items: ['wooden_sword', 'bandage', 'potion'],
    quests: ['luffy_training_1', 'find_meat_quest'],
    connections: ['shell_town', 'orange_town']
  },
  'shell_town': {
    name: '🏘️ Shell Town',
    description: 'Kota marinir tempat Zoro ditahan',
    level: 5,
    monsters: ['marine_trainee', 'axe_hand', 'corrupt_marine', 'helmeppo', 'morgan'],
    items: ['steel_sword', 'marine_coat', 'super_potion'],
    quests: ['zoro_training_1', 'find_swords'],
    connections: ['starter_island', 'orange_town']
  },
  'orange_town': {
    name: '🏠 Orange Town',
    description: 'Kota yang dikuasai Buggy si Badut',
    level: 10,
    monsters: ['buggy_pirate', 'mohji_richie', 'cabaji', 'buggy'],
    items: ['circus_knife', 'attack_boost', 'defense_boost'],
    quests: ['protect_civilians', 'defeat_buggy'],
    connections: ['shell_town', 'syrup_village']
  },
  'syrup_village': {
    name: '🌾 Syrup Village',
    description: 'Desa kelahiran Usopp',
    level: 15,
    monsters: ['black_cat_pirate', 'sham', 'buchi', 'jango', 'kuro'],
    items: ['slingshot', 'cat_claw', 'speed_boost'],
    quests: ['usopp_training_1', 'protect_village'],
    connections: ['orange_town', 'baratie']
  },
  'baratie': {
    name: '🍴 Baratie',
    description: 'Restoran terapung tempat Sanji bekerja',
    level: 20,
    monsters: ['cook_pirate'],
    items: ['kitchen_knife', 'chef_outfit', 'sanji_special'],
    quests: ['sanji_training_1', 'baratie_defense'],
    connections: ['syrup_village']
  },
  'loguetown': {
    name: '🏙️ Loguetown',
    description: 'Kota terakhir sebelum Grand Line',
    level: 25,
    monsters: ['street_thug', 'corrupt_merchant', 'bounty_hunter', 'smoker'],
    items: ['smoke_jitte', 'justice_coat', 'rumble_ball'],
    quests: ['final_preparation', 'smoker_challenge'],
    connections: ['baratie', 'arlong_park']
  },
  'arlong_park': {
    name: '🏰 Arlong Park',
    description: 'Markas bajak laut manusia ikan',
    level: 30,
    monsters: ['fishman_grunt', 'chu', 'kuroobi', 'hatchan', 'arlong'],
    items: ['shark_sword', 'fishman_suit', 'water_pearl'],
    quests: ['nami_rescue', 'fishman_duel'],
    connections: ['loguetown', 'drum_island']
  },
  'drum_island': {
    name: '❄️ Drum Island',
    description: 'Pulau musim dingin dengan dokter terbaik',
    level: 35,
    monsters: ['snow_beast', 'lapahn', 'wapol_soldier', 'chess', 'wapol'],
    items: ['doctor_tony', 'snow_coat', 'rumble_ball'],
    quests: ['doctor_quest', 'save_drum_kingdom'],
    connections: ['arlong_park']
  },
  'cocoyashi': {
    name: '🌴 Desa Cocoyashi',
    description: 'Desa kelahiran Nami',
    level: 28,
    monsters: ['fishman_patrol', 'corrupt_officer', 'arlong_elite'],
    items: ['clima_tact', 'map_tools', 'mikan'],
    quests: ['village_liberation', 'map_making'],
    connections: ['arlong_park', 'loguetown']
  },
  'foosha': {
    name: '🌊 Desa Foosha',
    description: 'Desa asal Luffy',
    level: 1,
    monsters: ['mountain_bandit', 'sea_king_small'],
    items: ['party_food', 'training_gear', 'sake'],
    quests: ['childhood_dreams', 'mountain_bandit_threat'],
    connections: ['starter_island']
  }
};

// Tambahan: Weather Effects
export const WEATHER_EFFECTS = {
  sunny: {
    name: '☀️ Cerah',
    description: 'Cuaca normal, sempurna untuk berlayar',
    effects: {
      sailingSpeed: 1.0,
      battleModifier: 1.0,
      explorationModifier: 1.0,
      dropRateModifier: 1.0
    }
  },
  rainy: {
    name: '🌧️ Hujan',
    description: 'Pergerakan melambat, tapi kesempatan mendapat item meningkat',
    effects: {
      sailingSpeed: 0.8,
      battleModifier: 0.9,
      explorationModifier: 0.7,
      dropRateModifier: 1.3
    }
  },
  stormy: {
    name: '⛈️ Badai',
    description: 'Sangat berbahaya untuk berlayar, tapi hadiah melimpah',
    effects: {
      sailingSpeed: 0.5,
      battleModifier: 0.7,
      explorationModifier: 0.4,
      dropRateModifier: 1.5
    }
  },
  foggy: {
    name: '🌫️ Berkabut',
    description: 'Visibilitas rendah, cocok untuk sembunyi',
    effects: {
      sailingSpeed: 0.7,
      battleModifier: 0.8,
      explorationModifier: 0.8,
      dropRateModifier: 1.2
    }
  },
  windy: {
    name: '💨 Berangin',
    description: 'Angin kencang mempengaruhi pertarungan jarak jauh',
    effects: {
      sailingSpeed: 1.2,
      battleModifier: 0.9,
      explorationModifier: 0.9,
      dropRateModifier: 1.0
    }
  }
} as const;

// Tambahan: Special Events
export const SPECIAL_EVENTS = {
  marine_invasion: {
    name: '⚓ Invasi Marinir',
    description: 'Pasukan marinir melakukan razia besar-besaran',
    effects: {
      marineSpawnRate: 2.0,
      pirateReputation: -50,
      rewardMultiplier: 1.5
    }
  },
  pirate_festival: {
    name: '🏴‍☠️ Festival Bajak Laut',
    description: 'Perayaan besar para bajak laut',
    effects: {
      merchantPrices: 0.8,
      expGain: 1.5,
      itemDiscovery: 1.3
    }
  },
  grand_line_storm: {
    name: '🌊 Badai Grand Line',
    description: 'Badai mematikan khas Grand Line',
    effects: {
      sailingSpeed: 0.3,
      shipDamage: 2.0,
      rareItemChance: 2.0
    }
  }
} as const; 