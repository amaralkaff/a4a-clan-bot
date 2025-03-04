// src/config/gameData.ts
import { LocationId } from '../types/game';
import gameDataJson from './gameData.json';
import weaponDataJson from './weaponData.json';
import armorDataJson from './armorData.json';
import accessoryDataJson from './accessoryData.json';
import consumableDataJson from './consumableData.json';
import monsterDataJson from './monsterData.json';

export type ItemType = 'WEAPON' | 'ARMOR' | 'ACCESSORY' | 'CONSUMABLE' | 'MATERIAL';
export type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHICAL' | 'DIVINE' | 'TRANSCENDENT' | 'CELESTIAL' | 'PRIMORDIAL' | 'ULTIMATE';
export type EffectType = 'EQUIP' | 'HEAL' | 'BUFF' | 'HEAL_AND_BUFF';
export type QuestType = 'COMBAT' | 'GATHER' | 'CRAFT' | 'HELP' | 'EXPLORE';

export interface Stats {
  attack?: number;
  defense?: number;
  health?: number;
  speed?: number;
}

export interface EffectData {
  type: EffectType;
  stats?: Stats;
  health?: number;
  duration?: number;
}

export type Effect = EffectData | string;

export interface GameItem {
  name: string;
  type: ItemType;
  description: string;
  price: number;
  effect: Effect;
  baseStats?: Stats;
  upgradeStats?: Stats;
  maxLevel?: number;
  rarity: Rarity;
  stackLimit: number;
  maxDurability?: number;
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  requiredLevel: number;
  rewards: {
    exp: number;
    coins: number;
    items: string[];
  };
  objectives: {
    [key: string]: number;
  };
  isDaily: boolean;
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

export interface JsonMonster {
  name: string;
  level: number;
  health: number;
  attack: number;
  defense: number;
  exp: number;
  coins: number;
  drops: Array<{ itemId: string; chance: number }>;
  description: string;
  location: string[];
}

export interface Monster {
  id: string;
  name: string;
  level: number;
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  exp: number;
  coins: number;
  drops: {
    itemId: string;
    chance: number;
  }[];
  description: string;
  location: LocationId[];
}

export interface Location {
  name: string;
  description: string;
  level: number;
}

export const LOCATIONS: Record<LocationId, Location> = {
  'starter_island': {
    name: '🏝️ Starter Island',
    description: 'Pulau pertama dalam petualanganmu',
    level: 1
  },
  'foosha': {
    name: '🌅 Foosha Village',
    description: 'Desa kecil tempat Luffy dibesarkan',
    level: 1
  },
  'syrup_village': {
    name: '🏘️ Syrup Village',
    description: 'Desa tempat tinggal Usopp',
    level: 5
  },
  'baratie': {
    name: '🚢 Baratie',
    description: 'Restoran terapung milik Zeff',
    level: 10
  },
  'arlong_park': {
    name: '🏰 Arlong Park',
    description: 'Markas bajak laut Arlong',
    level: 15
  },
  'loguetown': {
    name: '🌆 Loguetown',
    description: 'Kota terakhir sebelum Grand Line',
    level: 20
  },
  'drum_island': {
    name: '❄️ Drum Island',
    description: 'Pulau musim dingin tempat Chopper tinggal',
    level: 25
  },
  'cocoyashi': {
    name: '🎣 Cocoyashi Village',
    description: 'Desa tempat tinggal Nami',
    level: 30
  }
};

// Constants that should stay in TypeScript for easy access
export const RARITY_COLORS = {
  COMMON: '#B8B8B8',
  UNCOMMON: '#4CAF50',
  RARE: '#2196F3',
  EPIC: '#9C27B0',
  LEGENDARY: '#FFD700',
  MYTHICAL: '#FF69B4',
  DIVINE: '#8A2BE2',
  TRANSCENDENT: '#FF4500',
  CELESTIAL: '#000000',
  PRIMORDIAL: '#000000',
  ULTIMATE: '#FF0000'
} as const;

export const ITEM_TYPE_EMOJIS = {
  WEAPON: '⚔️',
  ARMOR: '🛡️',
  ACCESSORY: '💍',
  CONSUMABLE: '🧪',
  MATERIAL: '📦'
} as const;

export const QUEST_TYPES = {
  COMBAT: 'COMBAT',
  GATHER: 'GATHER',
  CRAFT: 'CRAFT',
  HELP: 'HELP',
  EXPLORE: 'EXPLORE'
} as const;

// Import data from JSON with proper typing
export const ITEMS: { [key: string]: GameItem } = {
  health_potion: {
    name: '❤️ Health Potion',
    type: 'CONSUMABLE',
    description: 'Restores 100 HP',
    price: 1000,
    effect: { type: 'HEAL', health: 100 },
    stackLimit: 99,
    rarity: 'COMMON'
  },
  wooden_sword: {
    name: '⚔️ Wooden Sword',
    type: 'WEAPON',
    description: 'A basic training sword',
    price: 2000,
    effect: { type: 'EQUIP', stats: { attack: 5 } },
    baseStats: { attack: 5 },
    upgradeStats: { attack: 2 },
    maxLevel: 5,
    stackLimit: 1,
    rarity: 'COMMON',
    maxDurability: 100
  },
  training_gi: {
    name: '🥋 Training Gi',
    type: 'ARMOR',
    description: 'Basic training clothes',
    price: 2000,
    effect: { type: 'EQUIP', stats: { defense: 5 } },
    baseStats: { defense: 5 },
    upgradeStats: { defense: 2 },
    maxLevel: 5,
    stackLimit: 1,
    rarity: 'COMMON',
    maxDurability: 100
  },
  leather_armor: {
    name: '🛡️ Leather Armor',
    type: 'ARMOR',
    description: 'Basic protective gear',
    price: 2000,
    effect: { type: 'EQUIP', stats: { defense: 5 } },
    stackLimit: 1,
    rarity: 'COMMON',
    maxDurability: 100
  },
  super_health_potion: {
    name: '💖 Super Health Potion',
    type: 'CONSUMABLE',
    description: 'Restores 250 HP',
    price: 2500,
    effect: { type: 'HEAL', health: 250 },
    stackLimit: 99,
    rarity: 'UNCOMMON'
  },
  training_weights: {
    name: '🏋️ Training Weights',
    type: 'ACCESSORY',
    description: 'Increases strength through training',
    price: 5000,
    effect: { type: 'EQUIP', stats: { attack: 8, speed: -2 } },
    stackLimit: 1,
    rarity: 'UNCOMMON',
    maxDurability: 100
  }
};

export const MONSTERS = monsterDataJson.MONSTERS as unknown as Record<string, JsonMonster>;