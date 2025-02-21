// src/types/game.ts

import { EmbedBuilder } from 'discord.js';

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
    userId: string;
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface StatusEffect {
    type: 'BURN' | 'POISON' | 'STUN' | 'HEAL_OVER_TIME';
    value: number;
    duration: number;
  }

  export interface ActiveBuff {
    type: 'ATTACK' | 'DEFENSE' | 'SPEED' | 'ALL';
    value: number;
    expiresAt: number;
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
    statusEffects: StatusEffects;
    activeBuffs: ActiveBuffs;
    dailyHealCount: number;
    lastHealTime?: Date;
    lastDailyReset?: Date;
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
  | 'shell_town'
  | 'orange_town'
  | 'syrup_village'
  | 'baratie'
  | 'loguetown'
  | 'arlong_park'
  | 'drum_island'
  | 'cocoyashi'
  | 'foosha';

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