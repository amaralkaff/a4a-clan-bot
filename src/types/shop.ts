import { EmbedBuilder } from 'discord.js';
import { Effect, EffectType, Stats } from './game';
import { GameItem, Rarity } from '../config/gameData';

export interface ItemStats extends Stats {
  [key: string]: number | undefined;
}

export interface ItemEffect {
  type: EffectType;
  stats?: ItemStats;
  durability?: number;
  maxDurability?: number;
  duration?: number;
  health?: number;
}

export interface DbItem {
  id: string;
  name: string;
  type: string;
  description: string;
  value: number;
  effect: string;
  maxDurability?: number | null;
  stackLimit: number;
  rarity: Rarity;
  baseStats: string | null;
  upgradeStats: string | null;
  maxLevel?: number | null;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  type: string;
  price: number;
  effect: Effect;
  baseStats?: string;
  upgradeStats?: string;
  maxDurability?: number | null;
  stackLimit: number;
  rarity: string;
  maxLevel?: number | null;
}

export interface BuyResult {
  success: boolean;
  message: string;
  embed?: EmbedBuilder;
}

export interface CachedShopItems {
  items: GameItem[];
  lastUpdated: number;
}

export interface CachedDbItems {
  items: DbItem[];
  lastUpdated: number;
}

export type ShopItemTuple = [string, GameItem]; 