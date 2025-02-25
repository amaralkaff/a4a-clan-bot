// src/types/game.ts

import { EmbedBuilder } from 'discord.js';

// Basic Types
export type EffectType = 'EQUIP' | 'BUFF' | 'HEAL' | 'HEAL_AND_BUFF';

export interface Stats {
  attack?: number;
  defense?: number;
  speed?: number;
  health?: number;
  accuracy?: number;
  healing?: number;
  exp_gain?: number;
  charisma?: number;
  luck?: number;
  cold_resist?: number;
  regeneration?: number;
}

export interface EffectData {
  type: EffectType;
  stats?: Stats;
  health?: number;
  duration?: number;
}

export type Effect = EffectData | string;

export type ItemType = 'WEAPON' | 'ARMOR' | 'ACCESSORY' | 'CONSUMABLE' | 'MATERIAL';

export type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

// Character
export interface CreateCharacterDto {
    discordId: string;
    name: string;
    mentor: MentorType;
  }
  
  export type MentorType = 'YB' | 'Tierison' | 'LYuka' | 'GarryAng';

  export interface Character {
    id: string;
    name: string;
    level: number;
    experience: number;
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
    currentIsland: LocationId;
    mentor: MentorType | null;
    luffyProgress: number;
    zoroProgress: number;
    usoppProgress: number;
    sanjiProgress: number;
    dailyHealCount: number;
    lastHealTime: Date | null;
    combo: number;
    questPoints: number;
    explorationPoints: number;
    lastDailyReset: Date | null;
    statusEffects: string;
    activeBuffs: string;
    // Currency system
    coins: number;
    bank: number;
    // Gambling stats
    totalGambled: number;
    totalWon: number;
    lastGambleTime: Date | null;
    // Battle stats
    wins: number;
    losses: number;
    winStreak: number;
    highestStreak: number;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface StatusEffect {
    type: 'POISON' | 'BURN' | 'FREEZE' | 'STUN' | 'HEAL_OVER_TIME';
    duration: number;
    value: number;
    source: string;
  }

  export interface ActiveBuff {
    type: 'ATTACK' | 'DEFENSE' | 'SPEED' | 'ALL';
    value: number;
    duration: number;
    expiresAt: number;
    source: string;
  }

  export enum QuestType {
    COMBAT = 'COMBAT',
    GATHERING = 'GATHERING',
    EXPLORATION = 'EXPLORATION',
    CRAFTING = 'CRAFTING',
    HELP = 'HELP',
    DAILY = 'DAILY',
    CRITICAL_HIT = 'CRITICAL_HIT',
    COMBO = 'COMBO',
    NAVIGATION = 'NAVIGATION',
    SECRET_DISCOVERY = 'SECRET_DISCOVERY'
  }

  export interface StatusEffects {
    effects: StatusEffect[];
  }

  export interface ActiveBuffs {
    buffs: ActiveBuff[];
  }

  export interface CharacterStats {
    level: number;
    experience: number;
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
    location: LocationId;
    mentor?: MentorType;
    luffyProgress: number;
    zoroProgress: number;
    usoppProgress: number;
    sanjiProgress: number;
    combo: number;
    questPoints: number;
    explorationPoints: number;
    statusEffects: StatusEffect[];
    activeBuffs: ActiveBuff[];
    dailyHealCount: number;
    lastHealTime?: Date;
    lastDailyReset?: Date;
    coins: number;
    bank: number;
    totalGambled: number;
    totalWon: number;
    lastGambleTime?: Date;
    wins: number;
    losses: number;
    winStreak: number;
    highestStreak: number;
    huntStreak: number;
    highestHuntStreak: number;
    lastHuntTime?: Date;
  }

  // NPC
export interface NpcCharacter {
    id: string;
    name: string;
    title: string;
    clanMember: MentorType;
    location: LocationId;
    dialogues: Record<string, string>;
    quests: string[];
    specialItems: string[];
    loyalty?: number;
  }
  
  export interface NpcInteraction {
    type: 'QUEST' | 'TRAINING' | 'TRADE' | 'DIALOGUE';
    requirementsMet: boolean;
    availableActions: string[];
    dialogue: string;
    loyalty?: number;
  }

  // Weather
export type WeatherType = 'sunny' | 'rainy' | 'stormy' | 'foggy' | 'windy';

export interface WeatherEffects {
  sailingSpeed: number;
  battleModifier: number;
  explorationModifier: number;
  dropRateModifier: number;
}

export interface Weather {
  type: WeatherType;
  name: string;
  description: string;
  effects: WeatherEffects;
}

// Battle
export interface BattleState {
  comboCount: number;
  gearSecondActive: boolean;
  gearSecondTurnsLeft: number;
  buffs: {
    attack?: number;
    defense?: number;
    expires: number;
  }[];
}

// Location
export interface Location {
  name: string;
  description: string;
  level: number;
  monsters: string[];
  items: string[];
  quests: string[];
  connections: LocationId[];
  weather?: WeatherType;
  lastWeatherUpdate?: Date;
  activeEvent?: string;
}

export type LocationId = 
  | 'starter_island'
  | 'foosha'
  | 'syrup_village'
  | 'baratie'
  | 'arlong_park'
  | 'loguetown'
  | 'drum_island'
  | 'cocoyashi';

export type LocationMap = Record<LocationId, Location>;

// Events
export type MarineInvasionEffects = {
  marineSpawnRate: number;
  pirateReputation: number;
  rewardMultiplier: number;
};

export type PirateFestivalEffects = {
  merchantPrices: number;
  expGain: number;
  itemDiscovery: number;
};

export type GrandLineStormEffects = {
  sailingSpeed: number;
  shipDamage: number;
  rareItemChance: number;
};

export type SpecialEventEffects = MarineInvasionEffects | PirateFestivalEffects | GrandLineStormEffects;

export interface SpecialEvent {
  name: string;
  description: string;
  effects: SpecialEventEffects;
}

export type SpecialEventType = 
  | 'marine_invasion'
  | 'pirate_festival'
  | 'grand_line_storm';

export interface ExplorationResult {
  embed: EmbedBuilder;
  exp: number;
  items: string[];
  messages: string[];
}

// Currency & Gambling
export interface Transaction {
  id: string;
  characterId: string;
  type: TransactionType;
  amount: number;
  description: string;
  createdAt: Date;
}

export type TransactionType = 
  | 'HUNT'
  | 'QUEST_REWARD' 
  | 'BATTLE_REWARD'
  | 'SHOP_PURCHASE'
  | 'GAMBLE_BET'
  | 'GAMBLE_WIN'
  | 'TRANSFER'
  | 'BANK_DEPOSIT'
  | 'BANK_WITHDRAW'
  | 'DAILY';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  effect: ItemEffect;
  type: 'CONSUMABLE' | 'EQUIPMENT';
}

export type ItemEffect = {
  type: 'HEAL';
  value: number;
} | {
  type: 'BUFF';
  stats: Partial<Record<'attack' | 'defense', number>>;
  duration: number;
} | {
  type: 'RANDOM_WEAPON';
};

export enum QuestStatus {
  TEMPLATE = 'TEMPLATE',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED'
}