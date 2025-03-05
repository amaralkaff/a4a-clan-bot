import { ActiveBuffs, StatusEffects } from './game';

export interface BattleState {
  combo: number;
  isGearSecond: boolean;
  gearSecondTurns: number;
  activeBuffs: ActiveBuffs;
  statusEffects: StatusEffects;
  firstStrike: boolean;
}

export interface DamageResult {
  damage: number;
  isCritical: boolean;
  critMultiplier: number;
}

export interface CombatResult {
  won: boolean;
  battleLog: string[];
  finalHealth: number;
  exp: number;
  coins: number;
  monster: {
    name: string;
    level: number;
  };
  streakInfo?: {
    streak: number;
    expBonus: string;
    coinsBonus: string;
    dropBonus: string;
  };
}

export interface CombatParticipant {
  id: string;
  name: string;
  level: number;
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  mentor?: string;
  speed?: number;
}

export interface StatusEffectResult {
  health: number;
  messages: string[];
} 