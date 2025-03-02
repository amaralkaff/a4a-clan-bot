// src/config/gameData.ts
import { LocationId } from '../types/game';
import gameDataJson from './gameData.json';
import weaponDataJson from './weaponData.json';
import armorDataJson from './armorData.json';
import accessoryDataJson from './accessoryData.json';
import consumableDataJson from './consumableData.json';

export type ItemType = 'WEAPON' | 'ARMOR' | 'ACCESSORY' | 'CONSUMABLE' | 'MATERIAL';
export type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHICAL' | 'DIVINE' | 'TRANSCENDENT';
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
  hp: number;
  attack: number;
  defense: number;
  exp: number;
  drops: string[];
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
  PRIMORDIAL: '#000000'
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
export const ITEMS = {
  ...gameDataJson.ITEMS,
  ...weaponDataJson,
  ...armorDataJson,
  ...accessoryDataJson,
  ...consumableDataJson
} as unknown as Record<string, GameItem>;

export const MONSTERS = gameDataJson.MONSTERS as unknown as Record<string, JsonMonster>;
export const QUESTS = gameDataJson.QUESTS as unknown as Record<string, Quest>;