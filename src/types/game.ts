// src/types/game.ts

// Character
export interface CreateCharacterDto {
    discordId: string;
    name: string;
  }
  
  export interface CharacterStats {
    level: number;
    experience: number;
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
    location: string;
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
  }
  
  export interface NpcInteraction {
    type: 'QUEST' | 'TRAINING' | 'TRADE' | 'DIALOGUE';
    requirementsMet: boolean;
    availableActions: string[];
    dialogue: string;
  }