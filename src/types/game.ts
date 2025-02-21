// src/types/game.ts

// Character
export interface CreateCharacterDto {
    discordId: string;
    name: string;
    mentor: 'YB' | 'Tierison' | 'LYuka' | 'GarryAng';
  }
  
  export interface CharacterStats {
    level: number;
    experience: number;
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
    location: string;
    mentor?: string;
    luffyProgress: number;
    zoroProgress: number;
    usoppProgress: number;
    sanjiProgress: number;
  }

  // NPC
export interface NpcCharacter {
    id: string;
    name: string;
    title: string;
    clanMember: string;
    location: string;
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
export interface Weather {
  type: 'SUNNY' | 'RAINY' | 'STORMY';
  effects: {
    sailingSpeed: number;
    battleModifier: number;
    explorationModifier: number;
    dropRateModifier: number;
  };
  description: string;
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