// src/config/gameData.ts
import { ItemType, Rarity, EffectType, Stats, Effect, LocationId } from '../types/game';

export interface GameItem {
  name: string;
  type: ItemType;
  description: string;
  price: number;
  effect?: Effect;
  baseStats?: Stats;
  upgradeStats?: Stats;
  maxLevel?: number;
  maxDurability?: number;
  stackLimit?: number;
  rarity: Rarity;
}

export interface QuestData {
  name: string;
  description: string;
  reward: number;
  requiredLevel: number;
  type: string;
  mentor?: string;
}

export interface WeaponUpgradeData {
  name: string;
  maxLevel: number;
  baseAttack: number;
  upgradeAttackPerLevel: number;
  materials: Record<string, number>;
  coins: number;
}

export interface MaterialData {
  name: string;
  description: string;
  dropFrom: string[];
  rarity: Rarity;
  stackLimit: number;
}

export interface Monster {
  name: string;
  level: number;
  hp: number;
  attack: number;
  defense: number;
  exp: number;
  drops: string[];
}

export interface Location {
  name: string;
  description: string;
  level: number;
  monsters: string[];
  items: string[];
  quests: string[];
  connections: string[];
}

// Export items
export const ITEMS: Record<string, GameItem> = {
  'wooden_sword': {
    name: '🗡️ Wooden Sword',
    type: 'WEAPON',
    description: '⚔️ Pedang kayu untuk pemula',
    price: 100,
    effect: {
      type: 'EQUIP',
      stats: { attack: 5 }
    },
    baseStats: { attack: 5, defense: 0 },
    upgradeStats: { attack: 2, defense: 1 },
    maxLevel: 5,
    rarity: 'COMMON',
    stackLimit: 1,
    maxDurability: 100
  },
  'training_gi': {
    name: '🥋 Training Gi',
    type: 'ARMOR',
    description: '🛡️ Baju latihan dasar',
    price: 100,
    effect: {
      type: 'EQUIP',
      stats: { defense: 5 }
    },
    baseStats: { defense: 5 },
    upgradeStats: { defense: 2 },
    maxLevel: 5,
    rarity: 'COMMON',
    stackLimit: 1,
    maxDurability: 100
  },
  'potion': {
    name: '🧪 Health Potion',
    type: 'CONSUMABLE',
    description: '❤️ Memulihkan 50 HP',
    price: 50,
    effect: {
      type: 'HEAL',
      health: 50
    },
    rarity: 'COMMON',
    stackLimit: 99
  },
  'gomu_gomu': {
    name: '🍎 Gomu Gomu no Mi',
    type: 'WEAPON',
    description: '🌟 Buah iblis yang memberikan kekuatan karet',
    price: 500000,
    effect: {
      type: 'EQUIP',
      stats: {
      attack: 100,
      defense: 50
      }
    },
    baseStats: {
      attack: 100,
      defense: 50
    },
    upgradeStats: {
      attack: 20,
      defense: 10
    },
    maxLevel: 10,
    rarity: 'LEGENDARY',
    stackLimit: 1
  },
  'mera_mera': {
    name: '🔥 Mera Mera no Mi',
    type: 'WEAPON',
    description: '🌟 Buah iblis api yang sangat kuat',
    price: 500000,
    effect: {
      type: 'EQUIP',
      stats: {
      attack: 120,
      defense: 30
      }
    },
    baseStats: {
      attack: 120,
      defense: 30
    },
    upgradeStats: {
      attack: 25,
      defense: 5
    },
    maxLevel: 10,
    rarity: 'LEGENDARY',
    stackLimit: 1
  },
  'wado_ichimonji': {
    name: '⚔️ Wado Ichimonji',
    type: 'WEAPON',
    description: '✨ Pedang warisan Kuina',
    price: 500000,
    effect: {
      type: 'EQUIP',
      stats: {
      attack: 80,
      defense: 15
      }
    },
    baseStats: {
      attack: 80,
      defense: 15
    },
    upgradeStats: {
      attack: 15,
      defense: 5
    },
    maxLevel: 8,
    rarity: 'EPIC',
    stackLimit: 1,
    maxDurability: 800
  },
  'clima_tact': {
    name: '🌪️ Clima-Tact',
    type: 'WEAPON',
    description: '✨ Senjata pengendali cuaca Nami',
    price: 450000,
    effect: {
      type: 'EQUIP',
      stats: {
      attack: 70,
      defense: 20
      }
    },
    baseStats: {
      attack: 70,
      defense: 20
    },
    upgradeStats: {
      attack: 15,
      defense: 5
    },
    maxLevel: 8,
    rarity: 'EPIC',
    stackLimit: 1,
    maxDurability: 700
  },
  'kitetsu': {
    name: '🗡️ Kitetsu',
    type: 'WEAPON',
    description: '💫 Pedang terkutuk',
    price: 200000,
    effect: {
      type: 'EQUIP',
      stats: {
      attack: 50,
      defense: 10
      }
    },
    baseStats: {
      attack: 50,
      defense: 10
    },
    upgradeStats: {
      attack: 10,
      defense: 3
    },
    maxLevel: 6,
    rarity: 'RARE',
    stackLimit: 1,
    maxDurability: 500
  },
  'sea_stone_armor': {
    name: '💠 Sea Stone Armor',
    type: 'ARMOR',
    description: '🌟 Armor dari batu laut',
    price: 900000,
    effect: {
      type: 'EQUIP',
      stats: {
      defense: 100,
      attack: 20
      }
    },
    baseStats: {
      defense: 100,
      attack: 20
    },
    upgradeStats: {
      defense: 20,
      attack: 5
    },
    maxLevel: 10,
    rarity: 'LEGENDARY',
    stackLimit: 1,
    maxDurability: 1000
  },
  'marine_admiral_coat': {
    name: '🧥 Marine Admiral Coat',
    type: 'ARMOR',
    description: '✨ Jubah khusus Admiral Angkatan Laut',
    price: 600000,
    effect: {
      type: 'EQUIP',
      stats: {
      defense: 80,
      attack: 15
      }
    },
    baseStats: {
      defense: 80,
      attack: 15
    },
    upgradeStats: {
      defense: 15,
      attack: 3
    },
    maxLevel: 8,
    rarity: 'EPIC',
    stackLimit: 1,
    maxDurability: 800
  },
  'pirate_armor': {
    name: '🥋 Pirate Armor',
    type: 'ARMOR',
    description: '💫 Armor bajak laut elit',
    price: 250000,
    effect: {
      type: 'EQUIP',
      stats: {
      defense: 50,
      attack: 10
      }
    },
    baseStats: {
      defense: 50,
      attack: 10
    },
    upgradeStats: {
      defense: 10,
      attack: 2
    },
    maxLevel: 6,
    rarity: 'RARE',
    stackLimit: 1,
    maxDurability: 500
  },
  'roger_hat': {
    name: '👒 Roger\'s Hat',
    type: 'ACCESSORY',
    description: '🌟 Topi legendaris Raja Bajak Laut',
    price: 1500000,
    effect: {
      type: 'EQUIP',
      stats: {
      attack: 50,
      defense: 50
      }
    },
    baseStats: {
      attack: 50,
      defense: 50
    },
    upgradeStats: {
      attack: 10,
      defense: 10
    },
    maxLevel: 10,
    rarity: 'LEGENDARY',
    stackLimit: 1
  },
  'log_pose': {
    name: '🧭 Eternal Log Pose',
    type: 'ACCESSORY',
    description: '✨ Penunjuk arah abadi',
    price: 400000,
    effect: {
      type: 'EQUIP',
      stats: {
      attack: 30,
      defense: 30
      }
    },
    baseStats: {
      attack: 30,
      defense: 30
    },
    upgradeStats: {
      attack: 5,
      defense: 5
    },
    maxLevel: 8,
    rarity: 'EPIC',
    stackLimit: 1
  },
  'rumble_ball': {
    name: '💊 Rumble Ball',
    type: 'CONSUMABLE',
    description: '⚡ Meningkatkan kekuatan 2x lipat selama 1 jam',
    price: 1000,
    effect: {
      type: 'BUFF',
      stats: {
        attack: 50,
        defense: 50
      },
      duration: 3600 
    },
    rarity: 'EPIC',
    stackLimit: 5
  },
  'meat': {
    name: '🍖 Daging Super',
    type: 'CONSUMABLE',
    description: '❤️ Memulihkan 1000 HP dan memberikan buff',
    price: 800,
    effect: {
      type: 'HEAL_AND_BUFF',
      health: 1000,
      stats: {
        attack: 20,
        defense: 20
      },
      duration: 1800 
    },
    rarity: 'RARE',
    stackLimit: 10
  },
  'sea_stone': {
    name: '💠 Batu Laut',
    type: 'MATERIAL',
    description: '✨ Material langka untuk upgrade senjata',
    price: 200000,
    rarity: 'EPIC',
    stackLimit: 100
  },
  'adam_wood': {
    name: '🌳 Kayu Adam',
    type: 'MATERIAL',
    description: '✨ Kayu terkuat untuk upgrade armor',
    price: 150000,
    rarity: 'EPIC',
    stackLimit: 100
  },
  'den_den_mushi': {
    name: '🐌 Den Den Mushi',
    type: 'MATERIAL',
    description: '📞 Siput komunikasi',
    price: 50000,
    rarity: 'RARE',
    stackLimit: 5
  },
  'wood': {
    name: '🪵 Kayu',
    type: 'MATERIAL',
    description: 'Material dasar untuk upgrade senjata',
    price: 100,
    rarity: 'COMMON',
    stackLimit: 100
  },
  'iron_ingot': {
    name: '⚔️ Besi',
    type: 'MATERIAL',
    description: 'Material untuk upgrade senjata tingkat menengah',
    price: 500,
    rarity: 'COMMON',
    stackLimit: 50
  },
  'steel_ingot': {
    name: '🛡️ Baja',
    type: 'MATERIAL',
    description: 'Material berkualitas untuk senjata kuat',
    price: 2000,
    rarity: 'UNCOMMON',
    stackLimit: 30
  },
  'rare_ore': {
    name: '💎 Bijih Langka',
    type: 'MATERIAL',
    description: 'Material langka untuk senjata tingkat tinggi',
    price: 10000,
    rarity: 'RARE',
    stackLimit: 20
  },
  'magic_crystal': {
    name: '✨ Kristal Sihir',
    type: 'MATERIAL',
    description: 'Kristal dengan kekuatan magis untuk senjata legendaris',
    price: 50000,
    rarity: 'EPIC',
    stackLimit: 10
  },
  'leather': {
    name: '🥋 Kulit',
    type: 'MATERIAL',
    description: 'Material dasar untuk armor dan aksesoris',
    price: 200,
    rarity: 'COMMON',
    stackLimit: 50
  },
  'bandage': {
    name: '🩹 Bandage',
    type: 'CONSUMABLE',
    description: 'Memulihkan 20 HP',
    price: 20,
    effect: {
      type: 'HEAL',
      health: 20
    },
    rarity: 'COMMON',
    stackLimit: 99
  },
  'fish_small': {
    name: '🐟 Ikan Kecil',
    type: 'CONSUMABLE',
    description: 'Memulihkan 30 HP',
    price: 30,
    effect: {
      type: 'HEAL',
      health: 30
    },
    rarity: 'COMMON',
    stackLimit: 99
  },
  'sea_crystal': {
    name: '💎 Kristal Laut',
    type: 'MATERIAL',
    description: 'Kristal indah dari dasar laut',
    price: 1000,
    rarity: 'UNCOMMON',
    stackLimit: 50
  },
  'banana': {
    name: '🍌 Pisang',
    type: 'CONSUMABLE',
    description: 'Memulihkan 25 HP',
    price: 25,
    effect: {
      type: 'HEAL',
      health: 25
    },
    rarity: 'COMMON',
    stackLimit: 99
  },
  'monkey_fur': {
    name: '🦊 Bulu Monyet',
    type: 'MATERIAL',
    description: 'Bulu halus untuk crafting',
    price: 150,
    rarity: 'COMMON',
    stackLimit: 99
  },
  'meat_raw': {
    name: '🥩 Daging Mentah',
    type: 'MATERIAL',
    description: 'Bisa dimasak menjadi makanan',
    price: 100,
    rarity: 'COMMON',
    stackLimit: 50
  },
  'boar_tusk': {
    name: '🦷 Taring Babi Hutan',
    type: 'MATERIAL',
    description: 'Material untuk crafting senjata',
    price: 300,
    rarity: 'UNCOMMON',
    stackLimit: 50
  },
  'pirate_coin': {
    name: '🪙 Koin Bajak Laut',
    type: 'MATERIAL',
    description: 'Koin langka dari bajak laut',
    price: 500,
    rarity: 'UNCOMMON',
    stackLimit: 999
  },
  'rum': {
    name: '🍺 Rum',
    type: 'CONSUMABLE',
    description: 'Meningkatkan ATK sementara',
    price: 200,
    effect: {
      type: 'BUFF',
      stats: {
        attack: 10
      },
      duration: 300
    },
    rarity: 'UNCOMMON',
    stackLimit: 10
  },
  'marine_badge': {
    name: '📛 Lencana Marine',
    type: 'MATERIAL',
    description: 'Bukti mengalahkan marinir',
    price: 1000,
    rarity: 'UNCOMMON',
    stackLimit: 100
  },
  'training_manual': {
    name: '📖 Manual Latihan',
    type: 'CONSUMABLE',
    description: 'Memberikan bonus EXP',
    price: 500,
    effect: {
      type: 'BUFF',
      stats: {
        exp_gain: 50
      },
      duration: 1800
    },
    rarity: 'UNCOMMON',
    stackLimit: 10
  },
  'steel_axe': {
    name: '🪓 Kapak Baja',
    type: 'WEAPON',
    description: 'Kapak kuat dari baja',
    price: 5000,
    effect: {
      type: 'EQUIP',
      stats: {
        attack: 15
      }
    },
    baseStats: {
      attack: 15
    },
    upgradeStats: {
      attack: 3
    },
    maxLevel: 5,
    rarity: 'UNCOMMON',
    stackLimit: 1,
    maxDurability: 200
  },
  'iron_plate': {
    name: '🛡️ Plat Besi',
    type: 'MATERIAL',
    description: 'Material untuk armor',
    price: 1000,
    rarity: 'UNCOMMON',
    stackLimit: 50
  },
  'golden_sword': {
    name: '⚔️ Pedang Emas',
    type: 'WEAPON',
    description: 'Pedang mewah berlapis emas',
    price: 20000,
    effect: {
      type: 'EQUIP',
      stats: {
        attack: 25,
        defense: 5
      }
    },
    baseStats: {
      attack: 25,
      defense: 5
    },
    upgradeStats: {
      attack: 5,
      defense: 1
    },
    maxLevel: 5,
    rarity: 'RARE',
    stackLimit: 1,
    maxDurability: 300
  },
  'fancy_clothes': {
    name: '👔 Baju Mewah',
    type: 'ARMOR',
    description: 'Baju berkelas tinggi',
    price: 15000,
    effect: {
      type: 'EQUIP',
      stats: {
      defense: 15,
        charisma: 10
      }
    },
    baseStats: {
      defense: 15,
      charisma: 10
    },
    upgradeStats: {
      defense: 3,
      charisma: 2
    },
    maxLevel: 5,
    rarity: 'RARE',
    stackLimit: 1,
    maxDurability: 200
  },
  'morgan_axe': {
    name: '🪓 Kapak Morgan',
    type: 'WEAPON',
    description: 'Kapak legendaris Kapten Morgan',
    price: 100000,
    effect: {
      type: 'EQUIP',
      stats: {
        attack: 40,
        defense: 10
      }
    },
    baseStats: {
      attack: 40,
      defense: 10
    },
    upgradeStats: {
      attack: 8,
      defense: 2
    },
    maxLevel: 8,
    rarity: 'EPIC',
    stackLimit: 1,
    maxDurability: 500
  },
  'captain_coat': {
    name: '🧥 Jubah Kapten',
    type: 'ARMOR',
    description: 'Jubah resmi Kapten Marine',
    price: 80000,
    effect: {
      type: 'EQUIP',
      stats: {
        defense: 30,
        charisma: 20
      }
    },
    baseStats: {
      defense: 30,
      charisma: 20
    },
    upgradeStats: {
      defense: 6,
      charisma: 4
    },
    maxLevel: 8,
    rarity: 'EPIC',
    stackLimit: 1,
    maxDurability: 400
  },
  'circus_knife': {
    name: '🔪 Pisau Sirkus',
    type: 'WEAPON',
    description: 'Pisau lempar akrobatik',
    price: 8000,
    effect: {
      type: 'EQUIP',
      stats: {
        attack: 20,
        accuracy: 15
      }
    },
    baseStats: {
      attack: 20,
      accuracy: 15
    },
    upgradeStats: {
      attack: 4,
      accuracy: 3
    },
    maxLevel: 6,
    rarity: 'RARE',
    stackLimit: 1,
    maxDurability: 250
  },
  'red_nose': {
    name: '👃 Hidung Merah',
    type: 'ACCESSORY',
    description: 'Hidung badut ajaib',
    price: 5000,
    effect: {
      type: 'EQUIP',
      stats: {
        luck: 10,
        charisma: 5
      }
    },
    baseStats: {
      luck: 10,
      charisma: 5
    },
    upgradeStats: {
      luck: 2,
      charisma: 1
    },
    maxLevel: 5,
    rarity: 'RARE',
    stackLimit: 1
  },
  'winter_coat': {
    name: '🧥 Mantel Musim Dingin',
    type: 'ARMOR',
    description: 'Melindungi dari cuaca dingin',
    price: 30000,
    effect: {
      type: 'EQUIP',
      stats: {
        defense: 25,
        cold_resist: 50
      }
    },
    baseStats: {
      defense: 25,
      cold_resist: 50
    },
    upgradeStats: {
      defense: 5,
      cold_resist: 10
    },
    maxLevel: 7,
    rarity: 'RARE',
    stackLimit: 1,
    maxDurability: 300
  },
  'medical_herb': {
    name: '🌿 Herbal Medis',
    type: 'CONSUMABLE',
    description: 'Ramuan penyembuh kuat',
    price: 1500,
    effect: {
      type: 'HEAL_AND_BUFF',
      health: 200,
      stats: {
        regeneration: 10
      },
      duration: 600
    },
    rarity: 'UNCOMMON',
    stackLimit: 20
  }
};

// Export locations
export const LOCATIONS: Record<LocationId, Location> = {
  'starter_island': {
    name: '🏝️ Starter Island',
    description: 'Pulau pertama dalam petualanganmu',
    level: 1,
    monsters: ['sea_beast_small', 'bandit_weak', 'wild_monkey', 'angry_boar', 'pirate_rookie'],
    items: ['wooden_sword', 'bandage', 'potion'],
    quests: ['luffy_training_1', 'find_meat_quest'],
    connections: ['shell_town', 'orange_town']
  },
  'foosha': {
    name: '🏝️ Foosha Village',
    description: 'Desa kecil tempat Luffy dibesarkan',
    level: 1,
    monsters: ['bandit_weak', 'wild_monkey'],
    items: ['wooden_sword', 'potion'],
    quests: ['tutorial_hunt'],
    connections: ['starter_island', 'syrup_village']
  },
  'syrup_village': {
    name: '🏘️ Syrup Village',
    description: 'Desa tempat tinggal Usopp',
    level: 5,
    monsters: ['wild_monkey', 'black_cat_pirate'],
    items: ['slingshot', 'potion'],
    quests: ['usopp_training'],
    connections: ['foosha', 'baratie']
  },
  'baratie': {
    name: '🚢 Baratie',
    description: 'Restoran terapung milik Zeff',
    level: 10,
    monsters: ['cook_pirate', 'fish_man'],
    items: ['kitchen_knife', 'combat_ration'],
    quests: ['sanji_training'],
    connections: ['syrup_village', 'arlong_park']
  },
  'arlong_park': {
    name: '🏰 Arlong Park',
    description: 'Markas bajak laut Arlong',
    level: 15,
    monsters: ['fishman_grunt', 'shark_warrior'],
    items: ['shark_tooth_sword', 'water_ring'],
    quests: ['defeat_arlong'],
    connections: ['baratie', 'loguetown']
  },
  'loguetown': {
    name: '🌆 Loguetown',
    description: 'Kota terakhir sebelum Grand Line',
    level: 20,
    monsters: ['marine_soldier', 'bounty_hunter'],
    items: ['marine_sword', 'log_pose'],
    quests: ['smoker_chase'],
    connections: ['arlong_park', 'drum_island']
  },
  'drum_island': {
    name: '❄️ Drum Island',
    description: 'Pulau musim dingin tempat Chopper tinggal',
    level: 25,
    monsters: ['snow_beast', 'wapol_soldier'],
    items: ['winter_coat', 'medical_herb'],
    quests: ['help_chopper'],
    connections: ['loguetown', 'cocoyashi']
  },
  'cocoyashi': {
    name: '🌊 Cocoyashi Village',
    description: 'Desa tempat tinggal Nami',
    level: 30,
    monsters: ['fishman_warrior', 'sea_king'],
    items: ['navigation_map', 'weather_staff'],
    quests: ['nami_treasure'],
    connections: ['drum_island']
  }
};

// Export quests
export const QUESTS: Record<string, QuestData> = {
  'tutorial_hunt': {
    name: '🗡️ Latihan Berburu',
    description: 'Kalahkan 3 monster di Foosha Village',
    reward: 100,
    requiredLevel: 1,
    type: 'COMBAT',
    mentor: undefined
  }
};

// Export weapon upgrades
export const WEAPON_UPGRADES: Record<string, WeaponUpgradeData> = {
  'wooden_sword': {
    name: '🗡️ Pedang Kayu',
    maxLevel: 5,
    baseAttack: 5,
    upgradeAttackPerLevel: 2,
    materials: {
      wood: 3,
      iron_ingot: 1
    },
    coins: 100
  },
  'steel_sword': {
    name: '⚔️ Pedang Baja',
    maxLevel: 7,
    baseAttack: 10,
    upgradeAttackPerLevel: 3,
    materials: {
      iron_ingot: 3,
      steel_ingot: 1
    },
    coins: 300
  },
  'wado_ichimonji': {
    name: '🗡️ Wado Ichimonji',
    maxLevel: 10,
    baseAttack: 25,
    upgradeAttackPerLevel: 5,
    materials: {
      steel_ingot: 3,
      rare_ore: 1,
      magic_crystal: 1
    },
    coins: 1000
  },
  'kitchen_knife': {
    name: '🔪 Pisau Dapur',
    maxLevel: 5,
    baseAttack: 8,
    upgradeAttackPerLevel: 2,
    materials: {
      iron_ingot: 2,
      wood: 1
    },
    coins: 200
  },
  'slingshot': {
    name: '🎯 Ketapel',
    maxLevel: 5,
    baseAttack: 7,
    upgradeAttackPerLevel: 2,
    materials: {
      wood: 2,
      leather: 1
    },
    coins: 150
  }
};

// Export monsters
export const MONSTERS: Record<string, Monster> = {
  'sea_beast_small': {
    name: '🦑 Baby Sea King',
    level: 1,
    hp: 50,
    attack: 5,
    defense: 3,
    exp: 20,
    drops: ['fish_small', 'sea_crystal']
  },
  'bandit_weak': {
    name: '👤 Bandit Lemah',
    level: 1,
    hp: 45,
    attack: 6,
    defense: 2,
    exp: 15,
    drops: ['wooden_sword', 'bandage']
  },
  'wild_monkey': {
    name: '🐒 Monyet Liar',
    level: 2,
    hp: 60,
    attack: 7,
    defense: 4,
    exp: 25,
    drops: ['banana', 'monkey_fur']
  },
  'angry_boar': {
    name: '🐗 Babi Hutan',
    level: 2,
    hp: 70,
    attack: 8,
    defense: 5,
    exp: 30,
    drops: ['meat_raw', 'boar_tusk']
  },
  'pirate_rookie': {
    name: '🏴‍☠️ Bajak Laut Pemula',
    level: 3,
    hp: 80,
    attack: 10,
    defense: 6,
    exp: 35,
    drops: ['pirate_coin', 'rum']
  },
  'marine_trainee': {
    name: '👮 Marinir Pelatih',
    level: 5,
    hp: 100,
    attack: 12,
    defense: 8,
    exp: 45,
    drops: ['marine_badge', 'training_manual']
  },
  'axe_hand': {
    name: '🪓 Tangan Kapak',
    level: 6,
    hp: 120,
    attack: 15,
    defense: 10,
    exp: 50,
    drops: ['steel_axe', 'iron_plate']
  },
  'corrupt_marine': {
    name: '🦹‍♂️ Marinir Korup',
    level: 7,
    hp: 130,
    attack: 16,
    defense: 12,
    exp: 55,
    drops: ['bribe_money', 'corrupt_badge']
  },
  'helmeppo': {
    name: '👑 Helmeppo',
    level: 8,
    hp: 150,
    attack: 18,
    defense: 15,
    exp: 70,
    drops: ['golden_sword', 'fancy_clothes']
  },
  'morgan': {
    name: '💀 Kapten Morgan',
    level: 10,
    hp: 200,
    attack: 25,
    defense: 20,
    exp: 100,
    drops: ['morgan_axe', 'captain_coat']
  },
  'buggy_pirate': {
    name: '🤡 Anak Buah Buggy',
    level: 10,
    hp: 160,
    attack: 20,
    defense: 15,
    exp: 75,
    drops: ['circus_knife', 'red_nose']
  },
  'mohji_richie': {
    name: '🦁 Mohji & Richie',
    level: 12,
    hp: 180,
    attack: 22,
    defense: 18,
    exp: 85,
    drops: ['lion_fang', 'beast_tamer_whip']
  },
  'cabaji': {
    name: '🎪 Cabaji',
    level: 13,
    hp: 190,
    attack: 23,
    defense: 19,
    exp: 90,
    drops: ['acrobat_sword', 'unicycle']
  },
  'buggy': {
    name: '🃏 Buggy si Badut',
    level: 15,
    hp: 250,
    attack: 30,
    defense: 25,
    exp: 120,
    drops: ['bara_bara_fruit', 'buggy_cape']
  },
  'black_cat_pirate': {
    name: '🐱‍👤 Bajak Laut Kucing Hitam',
    level: 15,
    hp: 200,
    attack: 25,
    defense: 20,
    exp: 95,
    drops: ['cat_claw', 'black_flag']
  },
  'sham': {
    name: '😺 Sham',
    level: 16,
    hp: 210,
    attack: 26,
    defense: 21,
    exp: 100,
    drops: ['cat_bell', 'stealth_boots']
  },
  'buchi': {
    name: '😾 Buchi',
    level: 16,
    hp: 220,
    attack: 27,
    defense: 22,
    exp: 100,
    drops: ['heavy_paw', 'cat_armor']
  },
  'jango': {
    name: '🎩 Jango',
    level: 17,
    hp: 230,
    attack: 28,
    defense: 23,
    exp: 110,
    drops: ['hypno_ring', 'chakram']
  },
  'kuro': {
    name: '👓 Kuro',
    level: 20,
    hp: 300,
    attack: 35,
    defense: 30,
    exp: 150,
    drops: ['cat_claws', 'kuro_glasses']
  },
  'cook_pirate': {
    name: '👨‍🍳 Bajak Laut Koki',
    level: 20,
    hp: 250,
    attack: 30,
    defense: 25,
    exp: 120,
    drops: ['kitchen_knife', 'spice_set']
  },
  'street_thug': {
    name: '🦹 Preman Jalanan',
    level: 25,
    hp: 280,
    attack: 32,
    defense: 28,
    exp: 130,
    drops: ['brass_knuckles', 'leather_jacket']
  },
  'corrupt_merchant': {
    name: '🤑 Pedagang Licik',
    level: 26,
    hp: 290,
    attack: 33,
    defense: 29,
    exp: 135,
    drops: ['fake_berry', 'merchant_list']
  },
  'bounty_hunter': {
    name: '🎯 Pemburu Hadiah',
    level: 27,
    hp: 300,
    attack: 35,
    defense: 30,
    exp: 140,
    drops: ['wanted_poster', 'hunter_badge']
  },
  'smoker': {
    name: '💨 Kapten Smoker',
    level: 30,
    hp: 400,
    attack: 45,
    defense: 40,
    exp: 200,
    drops: ['smoke_fruit', 'justice_coat']
  },
  'fishman_grunt': {
    name: '🐟 Anak Buah Arlong',
    level: 30,
    hp: 350,
    attack: 40,
    defense: 35,
    exp: 160,
    drops: ['fish_scale', 'water_pearl']
  },
  'chu': {
    name: '💦 Chu',
    level: 31,
    hp: 360,
    attack: 42,
    defense: 36,
    exp: 165,
    drops: ['water_gun', 'fish_teeth']
  },
  'kuroobi': {
    name: '🥋 Kuroobi',
    level: 32,
    hp: 370,
    attack: 44,
    defense: 38,
    exp: 170,
    drops: ['karate_gi', 'ray_fin']
  },
  'hatchan': {
    name: '🐙 Hatchan',
    level: 33,
    hp: 380,
    attack: 46,
    defense: 40,
    exp: 175,
    drops: ['six_swords', 'takoyaki']
  },
  'arlong': {
    name: '🦈 Arlong',
    level: 35,
    hp: 500,
    attack: 55,
    defense: 50,
    exp: 250,
    drops: ['saw_nose', 'shark_tooth']
  },
  'snow_beast': {
    name: '❄️ Binatang Salju',
    level: 35,
    hp: 400,
    attack: 48,
    defense: 42,
    exp: 180,
    drops: ['winter_fur', 'ice_crystal']
  },
  'lapahn': {
    name: '🐰 Lapahn',
    level: 36,
    hp: 410,
    attack: 50,
    defense: 44,
    exp: 185,
    drops: ['rabbit_meat', 'snow_boots']
  },
  'wapol_soldier': {
    name: '🤖 Tentara Wapol',
    level: 37,
    hp: 420,
    attack: 52,
    defense: 46,
    exp: 190,
    drops: ['metal_piece', 'tin_plate']
  },
  'chess': {
    name: '♟️ Chess',
    level: 38,
    hp: 430,
    attack: 54,
    defense: 48,
    exp: 195,
    drops: ['chess_piece', 'strategy_book']
  },
  'wapol': {
    name: '🤴 Wapol',
    level: 40,
    hp: 600,
    attack: 65,
    defense: 60,
    exp: 300,
    drops: ['munch_fruit', 'crown']
  }
};

// Export materials
export const MATERIALS: Record<string, MaterialData> = {
  'wood': { 
    name: '🪵 Kayu',
    description: 'Material dasar untuk upgrade senjata',
    dropFrom: ['wild_monkey', 'angry_boar'],
    rarity: 'COMMON',
    stackLimit: 100
  },
  'iron_ingot': {
    name: '⚔️ Besi',
    description: 'Material untuk upgrade senjata tingkat menengah',
    dropFrom: ['pirate_rookie', 'marine_trainee'],
    rarity: 'COMMON',
    stackLimit: 50
  },
  'steel_ingot': {
    name: '🛡️ Baja',
    description: 'Material berkualitas untuk senjata kuat',
    dropFrom: ['axe_hand', 'corrupt_marine'],
    rarity: 'UNCOMMON',
    stackLimit: 30
  },
  'rare_ore': {
    name: '💎 Bijih Langka',
    description: 'Material langka untuk senjata tingkat tinggi',
    dropFrom: ['morgan', 'buggy'],
    rarity: 'RARE',
    stackLimit: 20
  },
  'magic_crystal': {
    name: '✨ Kristal Sihir',
    description: 'Kristal dengan kekuatan magis untuk senjata legendaris',
    dropFrom: ['kuro', 'arlong'],
    rarity: 'EPIC',
    stackLimit: 10
  },
  'leather': {
    name: '🥋 Kulit',
    description: 'Material dasar untuk armor dan aksesoris',
    dropFrom: ['wild_monkey', 'angry_boar'],
    rarity: 'COMMON',
    stackLimit: 50
  },
  'sea_crystal': {
    name: '💎 Kristal Laut',
    description: 'Kristal indah dari dasar laut',
    dropFrom: ['sea_beast_small'],
    rarity: 'UNCOMMON',
    stackLimit: 50
  },
  'monkey_fur': {
    name: '🦊 Bulu Monyet',
    description: 'Bulu halus untuk crafting',
    dropFrom: ['wild_monkey'],
    rarity: 'COMMON',
    stackLimit: 99
  },
  'meat_raw': {
    name: '🥩 Daging Mentah',
    description: 'Bisa dimasak menjadi makanan',
    dropFrom: ['angry_boar'],
    rarity: 'COMMON',
    stackLimit: 50
  },
  'boar_tusk': {
    name: '🦷 Taring Babi Hutan',
    description: 'Material untuk crafting senjata',
    dropFrom: ['angry_boar'],
    rarity: 'UNCOMMON',
    stackLimit: 50
  },
  'pirate_coin': {
    name: '🪙 Koin Bajak Laut',
    description: 'Koin langka dari bajak laut',
    dropFrom: ['pirate_rookie'],
    rarity: 'UNCOMMON',
    stackLimit: 999
  },
  'marine_badge': {
    name: '📛 Lencana Marine',
    description: 'Bukti mengalahkan marinir',
    dropFrom: ['marine_trainee'],
    rarity: 'UNCOMMON',
    stackLimit: 100
  },
  'iron_plate': {
    name: '🛡️ Plat Besi',
    description: 'Material untuk armor',
    dropFrom: ['axe_hand'],
    rarity: 'UNCOMMON',
    stackLimit: 50
  }
};

// Export constants
export const RARITY_COLORS: Record<Rarity, string> = {
  'COMMON': '#FFFFFF',
  'UNCOMMON': '#1EFF00',
  'RARE': '#0070DD',
  'EPIC': '#A335EE',
  'LEGENDARY': '#FF8000'
} as const;

export const ITEM_TYPE_EMOJIS: Record<ItemType, string> = {
  'WEAPON': '⚔️',
  'ARMOR': '🛡️',
  'ACCESSORY': '💍',
  'CONSUMABLE': '🧪',
  'MATERIAL': '📦'
} as const; 
