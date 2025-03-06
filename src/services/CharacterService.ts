import { BaseService, InteractionSource } from './BaseService';
import { Character, PrismaClient } from '@prisma/client';
import { CONFIG } from '../config/config';
import { 
  CharacterStats, 
  CreateCharacterDto, 
  LocationId, 
  MentorType,
  StatusEffect,
  ActiveBuff,
  StatusEffects,
  ActiveBuffs,
  TransactionType,
  CharacterWithEquipment
} from '@/types/game';
import { Message, EmbedBuilder, ChatInputCommandInteraction, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, StringSelectMenuInteraction, ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ModalSubmitInteraction } from 'discord.js';
import { checkCooldown, setCooldown, getRemainingCooldown } from '@/utils/cooldown';
import { EmbedFactory } from '@/utils/embedBuilder';
import { ErrorUtils } from '@/utils/errorUtils';
import { BattleService } from './combat/BattleService';
import { InventoryService } from './InventoryService';
import { Cache } from '../utils/Cache';
import { BattleState } from '@/types/combat';
import { ICharacterCommands, InteractionHandler } from '@/types/commands';
import { LOCATIONS } from '@/config/gameData';

export interface ICharacterService {
  handleProfile: InteractionHandler;
  handleBalance: InteractionHandler;
  handleHunt: InteractionHandler;
  handleDaily: InteractionHandler;
  handleHelp: InteractionHandler;
  handleSell: (source: Message | ChatInputCommandInteraction, args?: string[]) => Promise<unknown>;
  handleLeaderboard: (source: Message | ChatInputCommandInteraction, type?: string) => Promise<unknown>;
  handleStart: (source: Message | ChatInputCommandInteraction) => Promise<unknown>;
}

// Character Factory for creating and converting character data
export class CharacterFactory {
  static createInitialStats(mentor: MentorType): {
    attack: number;
    defense: number;
    health: number;
    speed: number;
  } {
    // Base stats with newbie bonus
    let attack = CONFIG.STARTER_STATS.ATTACK + 15;
    let defense = CONFIG.STARTER_STATS.DEFENSE + 20;
    let health = CONFIG.STARTER_STATS.HEALTH + 50;
    let speed = CONFIG.STARTER_STATS.SPEED + 10;
    
    switch(mentor) {
      case 'YB': // Luffy
        attack = Math.floor(attack * 1.15); // +15% Attack
        defense = Math.floor(defense * 0.9); // -10% Defense
        health = Math.floor(health * 1.1); // +10% Health
        speed = Math.floor(speed * 1.2); // +20% Speed
        break;
      case 'Tierison': // Zoro
        attack = Math.floor(attack * 1.1); // +10% Attack
        defense = Math.floor(defense * 1.1); // +10% Defense
        speed = Math.floor(speed * 1.1); // +10% Speed
        break;
      case 'LYuka': // Usopp
        attack = Math.floor(attack * 0.9); // -10% Attack
        defense = Math.floor(defense * 1.2); // +20% Defense
        health = Math.floor(health * 1.05); // +5% Health
        speed = Math.floor(speed * 1.15); // +15% Speed
        break;
      case 'GarryAng': // Sanji
        attack = Math.floor(attack * 1.05); // +5% Attack
        defense = Math.floor(defense * 1.15); // +15% Defense
        health = Math.floor(health * 1.1); // +10% Health
        speed = Math.floor(speed * 1.3); // +30% Speed
        break;
    }

    return { attack, defense, health, speed };
  }

  static toCharacterStats(character: Character): CharacterStats {
    return {
      level: character.level,
      experience: Number(character.experience),
      health: character.health,
      maxHealth: character.maxHealth,
      attack: character.attack,
      defense: character.defense,
      speed: character.speed,
      mentor: character.mentor as MentorType,
      statusEffects: character.statusEffects ? JSON.parse(character.statusEffects) : { effects: [] },
      activeBuffs: character.activeBuffs ? JSON.parse(character.activeBuffs) : { buffs: [] },
      lastHealTime: character.lastHealTime || undefined,
      lastDailyReset: character.lastDailyReset || undefined,
      coins: Number(character.coins),
      bank: Number(character.bank),
      totalGambled: Number(character.totalGambled),
      totalWon: Number(character.totalWon),
      lastGambleTime: character.lastGambleTime || undefined,
      wins: character.wins,
      losses: character.losses,
      huntStreak: character.huntStreak,
      highestHuntStreak: character.highestHuntStreak,
      winStreak: character.winStreak,
      highestStreak: character.highestStreak,
      location: character.currentIsland as LocationId,
      luffyProgress: character.luffyProgress,
      zoroProgress: character.zoroProgress,
      usoppProgress: character.usoppProgress,
      sanjiProgress: character.sanjiProgress,
      combo: character.combo,
      questPoints: character.questPoints,
      explorationPoints: character.explorationPoints,
      dailyHealCount: character.dailyHealCount
    };
  }

  static toCharacterWithEquipment(character: Character): CharacterWithEquipment {
    return {
      id: character.id,
      name: character.name,
      level: character.level,
      health: character.health,
      maxHealth: character.maxHealth,
      attack: character.attack,
      defense: character.defense,
      mentor: character.mentor,
      speed: character.speed,
      huntStreak: character.huntStreak
    };
  }
}

// Utility class for character progression calculations
export class ProgressionUtils {
  static calculateExpNeeded(level: number): number {
    const baseExp = 1000;
    const expScaling = 1.15;
    const powerScaling = 1.1;
    
    let expNeeded = baseExp * Math.pow(expScaling, level);
    
    if (level > 50) expNeeded *= Math.pow(powerScaling, level - 50);
    if (level > 100) expNeeded *= Math.pow(1.2, level - 100);
    if (level > 200) expNeeded *= Math.pow(1.3, level - 200);
    if (level > 500) expNeeded *= Math.pow(1.5, level - 500);

    return Math.floor(expNeeded);
  }

  static calculateStatGains(currentLevel: number, levelsGained: number): {
    attack: number;
    defense: number;
    maxHealth: number;
    speed: number;
  } {
    const baseGain = 2;
    let multiplier = 1;

    if (currentLevel > 50) multiplier *= 1.2;
    if (currentLevel > 100) multiplier *= 1.3;
    if (currentLevel > 200) multiplier *= 1.4;
    if (currentLevel > 500) multiplier *= 1.5;

    const levelScaling = Math.pow(1.02, currentLevel);
    const finalGain = Math.floor(baseGain * multiplier * levelScaling);

    return {
      attack: finalGain * levelsGained,
      defense: finalGain * levelsGained,
      maxHealth: finalGain * 5 * levelsGained,
      speed: Math.floor(finalGain * 0.5 * levelsGained)
    };
  }

  static calculateMaxHealth(level: number): number {
    return 100 + (level * 10);
  }
}

export class CharacterService extends BaseService implements ICharacterCommands {
  private battleService: BattleService | null = null;
  private inventoryService: InventoryService | null = null;
  private characterCache: Cache<Character>;
  private statsCache: Cache<CharacterStats>;
  private balanceCache: Cache<{ coins: number; bank: number }>;
  protected battleStatesCache: Cache<BattleState> | null = null;
  private readonly CHARACTER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly STATS_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
  private readonly BALANCE_CACHE_TTL = 1 * 60 * 1000; // 1 minute

  constructor(prisma: PrismaClient) {
    super(prisma);
    this.inventoryService = new InventoryService(prisma, this);
    this.characterCache = new Cache<Character>(this.CHARACTER_CACHE_TTL);
    this.statsCache = new Cache<CharacterStats>(this.STATS_CACHE_TTL);
    this.balanceCache = new Cache<{ coins: number; bank: number }>(this.BALANCE_CACHE_TTL);

    // Set up periodic cache cleanup
    setInterval(() => {
      this.characterCache.cleanup();
      this.statsCache.cleanup();
      this.balanceCache.cleanup();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  setBattleService(battleService: BattleService) {
    this.battleService = battleService;
    this.battleStatesCache = battleService.getBattleStatesCache();
  }

  invalidateStatsCache(characterId: string) {
    this.statsCache.delete(characterId);
  }

  async invalidateAllCaches(characterId: string) {
    this.statsCache.delete(characterId);
    this.balanceCache.delete(characterId);
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { user: true }
    });
    
    if (character?.user?.discordId) {
      this.characterCache.delete(`discord_${character.user.discordId}`);
    }
  }

  calculateExpNeeded(level: number): number {
    // Exponential scaling for experience requirements
    // Base exp starts higher and scales much harder
    const baseExp = 1000; // Increased base exp requirement
    const expScaling = 1.15; // Exponential scaling factor (15% increase per level)
    const powerScaling = 1.1; // Additional power scaling for higher levels
    
    // Calculate exp needed with multiple scaling factors
    let expNeeded = baseExp * Math.pow(expScaling, level);
    
    // Additional scaling for higher levels
    if (level > 50) {
      expNeeded *= Math.pow(powerScaling, level - 50);
    }
    if (level > 100) {
      expNeeded *= Math.pow(1.2, level - 100); // 20% extra scaling after level 100
    }
    if (level > 200) {
      expNeeded *= Math.pow(1.3, level - 200); // 30% extra scaling after level 200
    }
    if (level > 500) {
      expNeeded *= Math.pow(1.5, level - 500); // 50% extra scaling after level 500
    }

    return Math.floor(expNeeded);
  }

  calculateStatGains(currentLevel: number, levelsGained: number): {
    attack: number;
    defense: number;
    maxHealth: number;
    speed: number;
  } {
    // Enhanced stat gains that scale with level
    const baseGain = 2;
    let multiplier = 1;

    // Increased multiplier based on level ranges
    if (currentLevel > 50) multiplier *= 1.2;
    if (currentLevel > 100) multiplier *= 1.3;
    if (currentLevel > 200) multiplier *= 1.4;
    if (currentLevel > 500) multiplier *= 1.5;

    // Calculate final gains with level scaling
    const levelScaling = Math.pow(1.02, currentLevel); // 2% increase per level
    const finalGain = Math.floor(baseGain * multiplier * levelScaling);

    return {
      attack: finalGain * levelsGained,
      defense: finalGain * levelsGained,
      maxHealth: finalGain * 5 * levelsGained, // Health scales 5x more
      speed: Math.floor(finalGain * 0.5 * levelsGained) // Speed scales 0.5x
    };
  }

  private validateMentor(mentor: string): asserts mentor is MentorType {
    if (!['YB', 'TIERISON', 'LYUKA', 'GARRYANG'].includes(mentor)) {
      throw new Error('❌ Mentor tidak valid! Pilih dari: YB, Tierison, LYuka, atau GarryAng');
    }
  }

  private validateCharacterName(name: string): void {
    // Allow letters, numbers, underscores, and hyphens
    const nameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!nameRegex.test(name)) {
      throw new Error('❌ Nama karakter hanya boleh mengandung huruf, angka, underscore (_), dan strip (-), dengan panjang 3-20 karakter.');
    }
  }

  async createCharacter(dto: CreateCharacterDto): Promise<Character> {
    try {
      // Validate mentor and name
      this.validateMentor(dto.mentor);
      this.validateCharacterName(dto.name);



      // Initialize empty status effects and buffs
      const initialStatusEffects: StatusEffects = { effects: [] };
      const initialActiveBuffs: ActiveBuffs = { 
        buffs: [{
          type: 'ALL',
          value: 15,
          duration: 7 * 24 * 60 * 60,
          expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
          source: 'newbie_bonus'
        }]
      };

      // Create or get user and character in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // First, check if user already has a character
        const existingUser = await tx.user.findUnique({
          where: { discordId: dto.discordId },
          include: { character: true }
        });

        if (existingUser?.character) {
          throw new Error('❌ Kamu sudah memiliki karakter!');
        }

        // Create or update user
        const user = await tx.user.upsert({
          where: { discordId: dto.discordId },
          create: { discordId: dto.discordId },
          update: {}
        });

        // Generate initial stats based on mentor
        const initialStats = CharacterFactory.createInitialStats(dto.mentor);

        // Create character
        const character = await tx.character.create({
          data: {
            name: dto.name,
            mentor: dto.mentor,
            userId: user.id,
            attack: initialStats.attack,
            defense: initialStats.defense,
            health: initialStats.health,
            maxHealth: initialStats.health,
            speed: initialStats.speed,
            currentIsland: 'starter_island',
            statusEffects: JSON.stringify(initialStatusEffects),
            activeBuffs: JSON.stringify(initialActiveBuffs),
            coins: 1000,  // Starting coins
            bank: 500    // Starting bank balance
          }
        });

        // Add starter items
        const starterItems = [
          { 
            itemId: 'wooden_sword',
            quantity: 1,
            durability: 100,
            maxDurability: 100,
            stats: JSON.stringify({
              attack: 5,
              defense: 0
            }),
            level: 1,
            upgrades: 0
          },
          { 
            itemId: 'training_gi',
            quantity: 1,
            durability: 100,
            maxDurability: 100,
            stats: JSON.stringify({
              attack: 0,
              defense: 5
            }),
            level: 1,
            upgrades: 0
          }
        ];

        // Verify items exist before creating inventory
        const existingItems = await tx.item.findMany({
          where: {
            id: {
              in: starterItems.map(item => item.itemId)
            }
          }
        });

        const existingItemIds = new Set(existingItems.map(item => item.id));

        // Add existing items to inventory
        for (const item of starterItems) {
          if (existingItemIds.has(item.itemId)) {
            await tx.inventory.create({
              data: {
                characterId: character.id,
                ...item
              }
            });
          }
        }

        return character;
      });

      // Clear all caches after character creation
      this.characterCache.clear();
      this.statsCache.clear();
      this.balanceCache.clear();

      // Verify character was created successfully
      const verifyCharacter = await this.prisma.character.findUnique({
        where: { id: result.id }
      });

      if (!verifyCharacter) {
        throw new Error('Failed to create character');
      }

      return verifyCharacter;
    } catch (error) {
      this.logger.error('Error in createCharacter:', error);
      throw error;
    }
  }

  async getCharacterByDiscordId(discordId: string) {
    try {
      // Always fetch fresh data from database for profiles
      const user = await this.prisma.user.findUnique({
        where: { discordId },
        include: { character: true }
      });

      if (user?.character) {
        // Update cache with fresh data
        const cacheKey = `discord_${discordId}`;
        this.characterCache.set(cacheKey, user.character);
      }

      return user?.character || null;
    } catch (error) {
      this.logger.error('Error getting character:', error);
      return null;
    }
  }

  async getCharacterStats(characterId: string): Promise<CharacterStats> {
    try {
      // Check cache first
      const cachedStats = this.statsCache.get(characterId);
      if (cachedStats) return cachedStats;

      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) {
        throw new Error('Character not found');
      }

      const stats = CharacterFactory.toCharacterStats(character);

      // Cache the stats
      this.statsCache.set(characterId, stats);

      return stats;
    } catch (error) {
      return this.handleError(error, 'GetCharacterStats');
    }
  }

  private calculateMaxHealth(level: number): number {
    // Simplified health calculation
    return 100 + (level * 10);
  }

  async heal(characterId: string, amount: number): Promise<number> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');

      const maxHealth = this.calculateMaxHealth(character.level);
      const newHealth = Math.min(character.health + amount, maxHealth);

      await this.prisma.character.update({
        where: { id: characterId },
        data: { health: newHealth }
      });

      // Invalidate stats cache since health changed
      this.statsCache.delete(characterId);

      return newHealth;
    } catch (error) {
      return this.handleError(error, 'Heal');
    }
  }

  async addExperience(characterId: string, amount: number): Promise<{
    leveledUp: boolean;
    newLevel?: number;
    newExp: number;
    levelsGained?: number;
    statsGained?: {
      attack: number;
      defense: number;
      maxHealth: number;
      speed: number;
    }
  }> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: {
        id: true,
        level: true,
        experience: true,
        user: true
      }
    });

    if (!character) throw new Error('Character not found');

    let { level, experience } = character;
    let newExp = BigInt(experience) + BigInt(amount);
    let levelsGained = 0;
    let currentLevel = level;

    // Calculate levels gained - removed level cap
    while (Number(newExp) >= this.calculateExpNeeded(currentLevel)) {
      const expNeeded = this.calculateExpNeeded(currentLevel);
      newExp = BigInt(Number(newExp) - expNeeded);
      currentLevel++;
      levelsGained++;
    }

    // Calculate stat gains if leveled up
    const statsGained = levelsGained > 0 ? this.calculateStatGains(level, levelsGained) : undefined;

    // Update character with new stats
    await this.prisma.character.update({
      where: { id: characterId },
      data: {
        level: currentLevel,
        experience: Number(newExp),
        ...(statsGained && {
          attack: { increment: statsGained.attack },
          defense: { increment: statsGained.defense },
          maxHealth: { increment: statsGained.maxHealth },
          speed: { increment: statsGained.speed }
        })
      }
    });

    // Invalidate caches since stats changed
    this.statsCache.delete(characterId);
    if (character.user?.discordId) {
      this.characterCache.delete(`discord_${character.user.discordId}`);
    }

    return {
      leveledUp: levelsGained > 0,
      newLevel: levelsGained > 0 ? currentLevel : undefined,
      newExp: Number(newExp),
      levelsGained: levelsGained > 0 ? levelsGained : undefined,
      statsGained
    };
  }

  async healWithSanji(characterId: string): Promise<{
    success: boolean;
    message: string;
    newHealth?: number;
  }> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');

      // Reset daily heal count if it's a new day
      if (character.lastHealTime && 
          new Date().getDate() !== character.lastHealTime.getDate()) {
        await this.prisma.character.update({
          where: { id: characterId },
          data: { dailyHealCount: 0 }
        });
      }

      if (character.dailyHealCount >= 3) {
        return {
          success: false,
          message: 'Kamu sudah mencapai batas penggunaan heal Sanji hari ini (3x/hari)'
        };
      }

      const healAmount = Math.floor(character.health * 0.25); // 25% HP heal
      const newHealth = await this.heal(characterId, healAmount);

      await this.prisma.character.update({
        where: { id: characterId },
        data: {
          dailyHealCount: { increment: 1 },
          lastHealTime: new Date()
        }
      });

      return {
        success: true,
        message: `Sanji menyembuhkan ${healAmount} HP!`,
        newHealth
      };
    } catch (error) {
      return this.handleError(error, 'HealWithSanji');
    }
  }

  async updateMentorProgress(characterId: string, mentorType: MentorType, amount: number) {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');

      const progressField = {
        'YB': 'luffyProgress',
        'Tierison': 'zoroProgress', 
        'LYuka': 'usoppProgress',
        'GarryAng': 'sanjiProgress'
      }[mentorType];

      if (!progressField) throw new Error('Invalid mentor type');

      await this.prisma.character.update({
        where: { id: characterId },
        data: {
          [progressField]: {
            increment: amount
          }
        }
      });
    } catch (error) {
      return this.handleError(error, 'UpdateMentorProgress');
    }
  }

  private validateStatusEffects(effects: string): void {
    try {
      const parsed = JSON.parse(effects) as StatusEffects;
      if (!Array.isArray(parsed.effects)) {
        throw new Error('Status effects harus berupa array');
      }
      
      for (const effect of parsed.effects) {
        if (!['BURN', 'POISON', 'STUN', 'HEAL_OVER_TIME'].includes(effect.type)) {
          throw new Error(`Tipe status effect tidak valid: ${effect.type}`);
        }
        if (typeof effect.value !== 'number' || effect.value < 0) {
          throw new Error('Value status effect harus berupa angka positif');
        }
        if (typeof effect.duration !== 'number' || effect.duration < 0) {
          throw new Error('Duration status effect harus berupa angka positif');
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Invalid status effects format: ${error.message}`);
      }
      throw new Error('Invalid status effects format');
    }
  }

  private validateActiveBuffs(buffs: string): void {
    try {
      const parsed = JSON.parse(buffs) as ActiveBuffs;
      if (!Array.isArray(parsed.buffs)) {
        throw new Error('Active buffs harus berupa array');
      }
      
      const validBuffTypes = [
        'ATTACK', 'DEFENSE', 'SPEED', 'ALL',
        'HEAL', 'HEAL_OVER_TIME', 'BURN', 'POISON',
        'STUN', 'DAMAGE', 'EXP', 'DROPS', 'HEALING',
        'RUMBLE_BALL', 'SUPER_MEAT', 'CRITICAL', 'COMBO',
        'GEAR_SECOND', 'TRAINING', 'MENTOR', 'FOOD',
        'EXPLORATION', 'QUEST', 'BATTLE'
      ];
      
      for (const buff of parsed.buffs) {
        if (!validBuffTypes.includes(buff.type)) {
          throw new Error(`Tipe buff tidak valid: ${buff.type}`);
        }
        
        if (typeof buff.expiresAt !== 'number' || buff.expiresAt < Date.now()) {
          throw new Error('ExpiresAt buff harus berupa timestamp valid');
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Invalid active buffs format: ${error.message}`);
      }
      throw new Error('Invalid active buffs format');
    }
  }

  async addStatusEffect(characterId: string, effect: StatusEffect): Promise<void> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');

      const currentEffects = JSON.parse(character.statusEffects) as StatusEffects;
      currentEffects.effects.push(effect);

      this.validateStatusEffects(JSON.stringify(currentEffects));

      await this.prisma.character.update({
        where: { id: characterId },
        data: {
          statusEffects: JSON.stringify(currentEffects)
        }
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        return this.handleError(error, 'AddStatusEffect');
      }
      return this.handleError(new Error('Unknown error in AddStatusEffect'), 'AddStatusEffect');
    }
  }

  async addBuff(characterId: string, buff: ActiveBuff): Promise<void> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');

      const currentBuffs = JSON.parse(character.activeBuffs) as ActiveBuffs;
      currentBuffs.buffs.push(buff);

      this.validateActiveBuffs(JSON.stringify(currentBuffs));

      await this.prisma.character.update({
        where: { id: characterId },
        data: {
          activeBuffs: JSON.stringify(currentBuffs)
        }
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        return this.handleError(error, 'AddBuff');
      }
      return this.handleError(new Error('Unknown error in AddBuff'), 'AddBuff');
    }
  }

  async cleanupExpiredEffectsAndBuffs(characterId: string): Promise<void> {
    // Single update for both effects and buffs
      await this.prisma.character.update({
        where: { id: characterId },
        data: {
        statusEffects: JSON.stringify({ effects: [] }),
        activeBuffs: JSON.stringify({ buffs: [] })
      }
    });
  }

  async checkAndResetDaily(characterId: string): Promise<void> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');

      const now = new Date();
      if (!character.lastDailyReset || 
          character.lastDailyReset.getDate() !== now.getDate()) {
        await this.prisma.character.update({
          where: { id: characterId },
          data: {
            lastDailyReset: now,
            dailyHealCount: 0
          }
        });
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        return this.handleError(error, 'CheckAndResetDaily');
      }
      return this.handleError(new Error('Unknown error in CheckAndResetDaily'), 'CheckAndResetDaily');
    }
  }

  async resetCharacter(discordId: string): Promise<void> {
    try {
      // Clear all caches first
      const cacheKey = `discord_${discordId}`;
      this.characterCache.delete(cacheKey);
      
      // Get user and character
      const user = await this.prisma.user.findUnique({
        where: { discordId },
        include: { character: true }
      });

      if (!user || !user.character) {
        throw new Error('Karakter tidak ditemukan');
      }

      // Clear all related caches
      this.statsCache.delete(user.character.id);
      this.balanceCache.delete(user.character.id);
      this.battleStatesCache?.delete(user.character.id);

      // Delete all related data in a transaction
      await this.prisma.$transaction(async (tx) => {
        // Delete inventory items first
        await tx.inventory.deleteMany({
          where: { characterId: user.character!.id }
        });

        // Delete quests
        await tx.quest.deleteMany({
          where: { characterId: user.character!.id }
        });

        // Delete battles
        await tx.battle.deleteMany({
          where: { characterId: user.character!.id }
        });

        // Delete transactions
        await tx.transaction.deleteMany({
          where: { characterId: user.character!.id }
        });

        // Delete duels
        await tx.duel.deleteMany({
          where: {
            OR: [
              { challengerId: user.character!.id },
              { challengedId: user.character!.id }
            ]
          }
        });

        // Delete character first since it references user
        await tx.character.delete({
          where: { id: user.character!.id }
        });

        // Finally delete user
        await tx.user.delete({
          where: { id: user.id }
        });
      });

      // Clear all caches again after successful deletion
      this.characterCache.clear();
      this.statsCache.clear();
      this.balanceCache.clear();
      if (this.battleStatesCache) this.battleStatesCache.clear();
    } catch (error) {
      this.logger.error('Error in resetCharacter:', error);
      throw error;
    }
  }

  // Implement interface methods
  async handleProfile(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    try {
      const userId = this.getUserId(source);
      const embed = await this.createProfileEmbed(userId);
      return this.sendEmbedResponse(source, embed);
    } catch (error) {
      return this.handleCommandError(error, source, 'handleProfile');
    }
  }

  async handleBalance(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    try {
      const userId = this.getUserId(source);
      const character = await this.validateCharacter(userId, source);
      if (!character) return;

      const balance = await this.getBalance(character.id);
      const history = await this.getTransactionHistory(character.id, 5);
      const embed = EmbedFactory.buildBalanceEmbed(balance.coins, balance.bank, history);
      return this.sendEmbedResponse(source, embed);
    } catch (error) {
      return ErrorUtils.handleTransactionError(source, error);
    }
  }

  async handleHunt(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    try {
      const userId = this.getUserId(source);
      const character = await this.validateCharacter(userId, source);
      if (!character) return;

      if (!this.battleService) {
        throw new Error('Battle service not initialized');
      }

      const response = await this.battleService.processBattle(character.id, character.level);
      return this.sendEmbedResponse(source, response.embed);
    } catch (error) {
      return ErrorUtils.handleCombatError(source, error);
    }
  }

  async handleDaily(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    try {
      const userId = this.getUserId(source);
      
      if (!checkCooldown(userId, 'daily')) {
        const remainingTime = getRemainingCooldown(userId, 'daily');
        const hours = Math.floor(remainingTime / 3600);
        const minutes = Math.floor((remainingTime % 3600) / 60);
        return ErrorUtils.handleCooldown(source, `${hours}h ${minutes}m`);
      }

      const character = await this.validateCharacter(userId, source);
      if (!character) return;

      const exp = 100 + Math.floor(Math.random() * 50);
      const coins = 100 + Math.floor(Math.random() * 100);
      
      await this.addExperience(character.id, exp);
      await this.addCoins(character.id, coins, 'DAILY', 'Daily reward');
      
      const embed = EmbedFactory.buildDailyRewardEmbed(exp, coins);
      setCooldown(userId, 'daily');
      return this.sendEmbedResponse(source, embed);
    } catch (error) {
      return this.handleCommandError(error, source, 'handleDaily');
    }
  }

  async handleHelp(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    try {
      const embed = EmbedFactory.buildHelpEmbed();
      return this.sendEmbedResponse(source, embed);
    } catch (error) {
      return this.handleCommandError(error, source, 'handleHelp');
    }
  }

  async handleSell(source: Message | ChatInputCommandInteraction, args?: string[]): Promise<unknown> {
    try {
      const userId = this.getUserId(source);
      const character = await this.validateCharacter(userId, source);
      if (!character) return;

      if (!args || args.length === 0) {
        return source.reply('❌ Please specify what you want to sell!');
      }

      if (!this.inventoryService) {
        throw new Error('Inventory service not initialized');
      }

          const embed = new EmbedBuilder()
        .setTitle('🏪 Market')
        .setColor('#ffd700')
        .setDescription('Sell feature coming soon!');

      return this.sendEmbedResponse(source, embed);
    } catch (error) {
      return this.handleCommandError(error, source, 'handleSell');
    }
  }

  async handleLeaderboard(source: Message | ChatInputCommandInteraction, type?: string): Promise<unknown> {
    try {
      let currentPage = source instanceof ChatInputCommandInteraction 
        ? (source.options.getInteger('page') || 1)
        : 1;
      
      type = type?.toLowerCase() || 'level';
      const itemsPerPage = 10;

        // Get total count for pagination
      const totalCount = await this.prisma.character.count();
        const totalPages = Math.ceil(totalCount / itemsPerPage);

        // Validate page number
      if (currentPage < 1 || currentPage > totalPages) {
        return source.reply({
          content: '❌ Invalid page number!',
          ephemeral: true
        });
      }

      const skip = (currentPage - 1) * itemsPerPage;

        // Get characters for current page
        const characters = await this.prisma.character.findMany({
          take: itemsPerPage,
          skip,
        orderBy: { level: 'desc' },
          select: {
            name: true,
            level: true,
          experience: true
          }
        });

        if (characters.length === 0) {
        return source.reply({
          content: '❌ No characters found!',
          ephemeral: true
        });
        }

        const embed = new EmbedBuilder()
        .setTitle('🏆 Leaderboard')
          .setColor('#FFD700')
        .setDescription(characters.map((char, index) => {
              const position = skip + index + 1;
              const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '🏅';
          return `${medal} ${position}. ${char.name} - Level ${char.level} (${char.experience} EXP)`;
        }).join('\n'))
        .setFooter({ text: `Page ${currentPage}/${totalPages}` });

        return source.reply({
        embeds: [embed],
        ephemeral: false 
      });
    } catch (error) {
      return this.handleCommandError(error, source, 'handleLeaderboard');
    }
  }

  async handleStart(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    try {
      const userId = this.getUserId(source);
      
      const existingCharacter = await this.getCharacterByDiscordId(userId);
      if (existingCharacter) {
        return source.reply({
          content: '❌ Kamu sudah memiliki karakter! Gunakan `/profile` untuk melihat karaktermu.',
          ephemeral: true
        });
      }

        const embed = new EmbedBuilder()
          .setTitle('🎮 Buat Karakter Baru')
        .setDescription('Untuk membuat karakter baru, gunakan command:\n`a start <nama> <mentor>`')
          .addFields(
            { 
              name: '🏴‍☠️ YB (Luffy)',
            value: '+15% Attack, -10% Defense, +10% Health, +20% Speed',
              inline: true
            },
            {
              name: '⚔️ Tierison (Zoro)',
            value: '+10% Attack, +10% Defense, +10% Speed',
              inline: true
            },
            {
              name: '🎯 LYuka (Usopp)',
            value: '-10% Attack, +20% Defense, +5% Health, +15% Speed',
              inline: true
            },
            {
              name: '🔥 GarryAng (Sanji)',
            value: '+5% Attack, +15% Defense, +10% Health, +30% Speed',
              inline: true
            }
          )
        .setColor('#00ff00');

        return source.reply({ embeds: [embed] });
    } catch (error) {
      return this.handleCommandError(error, source, 'handleStart');
    }
  }

  // Utility methods
  private getUserId(source: Message | ChatInputCommandInteraction): string {
    return source instanceof Message ? source.author.id : source.user.id;
  }

  private async validateCharacter(userId: string, source: Message | ChatInputCommandInteraction): Promise<Character | null> {
    try {
      const cacheKey = `discord_${userId}`;
      this.characterCache.delete(cacheKey);
      
      const character = await this.getCharacterByDiscordId(userId);
      
      if (!character) {
        await ErrorUtils.handleCharacterNotFound(source);
        return null;
      }

      const dbCharacter = await this.prisma.character.findUnique({
        where: { id: character.id }
      });

      if (!dbCharacter) {
        this.characterCache.clear();
        this.statsCache.clear();
        this.balanceCache.clear();
        await ErrorUtils.handleCharacterNotFound(source);
        return null;
      }

      return dbCharacter;
    } catch (error) {
      this.logger.error('Error validating character:', error);
      await ErrorUtils.handleError({
        context: 'CHARACTER',
        error: 'Failed to validate character',
        source
      });
      return null;
    }
  }

  private async sendEmbedResponse(source: Message | ChatInputCommandInteraction, embed: EmbedBuilder): Promise<unknown> {
    if (source instanceof Message) {
      return source.reply({ embeds: [embed] });
    } else {
      if (source.deferred) {
        return source.editReply({ embeds: [embed] });
      } else if (source.replied) {
        return source.followUp({ embeds: [embed], ephemeral: true });
      } else {
        return source.reply({ embeds: [embed], ephemeral: true });
      }
    }
  }

  private async handleCommandError(error: unknown, source: Message | ChatInputCommandInteraction, context: string): Promise<unknown> {
    return ErrorUtils.handleError({
      context,
      error,
      source
    });
  }

  private async createProfileEmbed(userId: string): Promise<EmbedBuilder> {
    const cacheKey = `discord_${userId}`;
    this.characterCache.delete(cacheKey);

    const character = await this.getCharacterByDiscordId(userId);
    
    if (!character) {
      throw new Error('❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.');
    }

    this.statsCache.delete(character.id);
    const stats = await this.getCharacterStats(character.id);

    this.balanceCache.delete(character.id);
    const balance = await this.getBalance(character.id);

    // Get equipped items
    const equippedItems = await this.prisma.inventory.findMany({
      where: {
        characterId: character.id,
        isEquipped: true
      },
      include: {
        item: true
      }
    });

    // Calculate equipment stats
    let equipmentStats = {
      attack: 0,
      defense: 0,
      speed: 0
    };

    for (const equipped of equippedItems) {
      if (equipped.stats) {
        const itemStats = JSON.parse(equipped.stats);
        equipmentStats.attack += itemStats.attack || 0;
        equipmentStats.defense += itemStats.defense || 0;
        equipmentStats.speed += itemStats.speed || 0;
      }
    }

    // Calculate total stats including equipment
    const totalStats = {
      attack: stats.attack + equipmentStats.attack,
      defense: stats.defense + equipmentStats.defense,
      speed: stats.speed + equipmentStats.speed
    };

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${character.name}'s Profile`)
      .setColor('#0099ff')
      .addFields(
        { 
          name: '📈 Level & Experience', 
          value: `Level: ${stats.level}\nEXP: ${stats.experience.toLocaleString()}/${this.calculateExpNeeded(stats.level).toLocaleString()}`,
          inline: true 
        },
        { 
          name: '❤️ Health',
          value: `${stats.health}/${stats.maxHealth} HP`,
          inline: true 
        },
        {
          name: '📍 Location',
          value: LOCATIONS[stats.location].name,
          inline: true
        },
        { 
          name: '💰 Balance', 
          value: `Coins: ${balance.coins.toLocaleString()}`,
          inline: true 
        },
        {
          name: '🎰 Equipment',
          value: equippedItems.length > 0 ? equippedItems.map(item => {
            const stats = item.stats ? JSON.parse(item.stats) : null;
            const durability = item.durability !== null ? ` (${item.durability}/${item.item.maxDurability})` : '';
            return `${item.item.type === 'WEAPON' ? '⚔️' : item.item.type === 'ARMOR' ? '🛡️' : '💍'} ${item.item.name}${durability}\n` + 
                   (stats ? `└ Stats: ATK +${stats.attack || 0} | DEF +${stats.defense || 0} | SPD +${stats.speed || 0}` : '');
          }).join('\n\n') : 'No equipment',
          inline: false
        },
        {
          name: '⚔️ Combat Stats',
          value: [
            `Attack: ${totalStats.attack} (+${equipmentStats.attack} from equipment)`,
            `Defense: ${totalStats.defense} (+${equipmentStats.defense} from equipment)`,
            `Speed: ${totalStats.speed} (+${equipmentStats.speed} from equipment)`
          ].join('\n'),
          inline: false
        }
      );

    // Add active buffs if any exist
    const activeBuffs = JSON.parse(character.activeBuffs || '{"buffs":[]}');
    if (activeBuffs.buffs && activeBuffs.buffs.length > 0) {
      const currentTime = Date.now();
      const activeBuffsList = activeBuffs.buffs
        .filter((buff: { expiresAt: number }) => buff.expiresAt > currentTime)
        .map((buff: { type: string; value: number; expiresAt: number }) => {
          const timeLeft = Math.ceil((buff.expiresAt - currentTime) / (1000 * 60)); // minutes
          return `${buff.type}: +${buff.value}% (${timeLeft}m)`;
        })
        .join('\n');
      
      if (activeBuffsList) {
        embed.addFields({
          name: '✨ Active Buffs',
          value: activeBuffsList,
          inline: false
        });
      }
    }

    // Add status effects if any exist
    const statusEffects = JSON.parse(character.statusEffects || '{"effects":[]}');
    if (statusEffects.effects && statusEffects.effects.length > 0) {
      const effectsList = statusEffects.effects
        .map((effect: { type: string; value: number; duration: number }) => 
          `${effect.type}: ${effect.value} (${effect.duration}s)`
        )
        .join('\n');
      
      if (effectsList) {
        embed.addFields({
          name: '🔮 Status Effects',
          value: effectsList,
          inline: false
        });
      }
    }

    // Add battle record only if there are wins or losses
    if (stats.wins > 0 || stats.losses > 0) {
      embed.addFields({
        name: '🎯 Battle Record',
        value: [
          `Wins: ${stats.wins}`,
          `Losses: ${stats.losses}`,
          `Win Rate: ${Math.round((stats.wins / (stats.wins + stats.losses)) * 100)}%`,
          `Streak: ${stats.winStreak}`
        ].join('\n'),
        inline: true
      });
    }

    // Add hunt stats only if there's a streak
    if (stats.huntStreak > 0) {
      embed.addFields({
        name: '🏃 Hunt Stats',
        value: [
          `Hunt Streak: ${stats.huntStreak}`,
          `Quest Points: ${stats.questPoints}`
        ].join('\n'),
        inline: true
      });
    }

    // Add mentor info if available
    if (stats.mentor) {
      const mentorProgress = [];
      if (stats.luffyProgress > 0) mentorProgress.push(`Luffy: ${stats.luffyProgress}%`);
      if (stats.zoroProgress > 0) mentorProgress.push(`Zoro: ${stats.zoroProgress}%`);
      if (stats.usoppProgress > 0) mentorProgress.push(`Usopp: ${stats.usoppProgress}%`);
      if (stats.sanjiProgress > 0) mentorProgress.push(`Sanji: ${stats.sanjiProgress}%`);

      if (mentorProgress.length > 0) {
        embed.addFields({
          name: '👨‍🏫 Mentor Progress',
          value: mentorProgress.join('\n'),
          inline: false
        });
      }
    }

    return embed;
  }

  // Transaction and balance methods
  async getBalance(characterId: string): Promise<{ coins: number; bank: number }> {
    try {
      const cachedBalance = this.balanceCache.get(characterId);
      if (cachedBalance) return cachedBalance;

      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) {
        throw new Error('Character not found');
      }

      const balance = {
        coins: Number(character.coins),
        bank: Number(character.bank)
      };

      this.balanceCache.set(characterId, balance);
      return balance;
    } catch (error) {
      this.logger.error('Error in getBalance:', error);
      throw error;
    }
  }

  async getTransactionHistory(characterId: string, limit: number = 10): Promise<any[]> {
    try {
      return await this.prisma.transaction.findMany({
        where: { characterId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
    } catch (error) {
      this.logger.error('Error in getTransactionHistory:', error);
      throw error;
    }
  }

  async addCoins(characterId: string, amount: number, type: TransactionType, description: string): Promise<void> {
    try {
      await this.prisma.$transaction([
        this.prisma.character.update({
          where: { id: characterId },
          data: { coins: { increment: amount } }
        }),
        this.prisma.transaction.create({
          data: {
            characterId,
            type,
            amount,
            description
          }
        })
      ]);

      this.balanceCache.delete(characterId);
      this.statsCache.delete(characterId);
    } catch (error) {
      this.logger.error('Error in addCoins:', error);
      throw error;
    }
  }

  async removeCoins(characterId: string, amount: number, type: TransactionType, description: string): Promise<void> {
    try {
      await this.prisma.$transaction([
        this.prisma.character.update({
          where: { id: characterId },
          data: { coins: { decrement: amount } }
        }),
        this.prisma.transaction.create({
          data: {
            characterId,
            type,
            amount: -amount,
            description
          }
        })
      ]);

      this.balanceCache.delete(characterId);
      this.statsCache.delete(characterId);
    } catch (error) {
      this.logger.error('Error in removeCoins:', error);
      throw error;
    }
  }

  // Add items to character's inventory
  async addItems(characterId: string, itemId: string, quantity: number): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // Get item info first
        const item = await tx.item.findUnique({
          where: { id: itemId }
        });

        if (!item) {
          throw new Error('Item not found');
        }

        // Upsert the inventory entry
        await tx.inventory.upsert({
          where: {
            characterId_itemId: {
              characterId,
              itemId
            }
          },
          create: {
            characterId,
            itemId,
            quantity,
            durability: item.type === 'WEAPON' || item.type === 'ARMOR' ? 100 : null,
            maxDurability: item.maxDurability || null,
            effect: item.effect,
            stats: item.baseStats || '{}',
            isEquipped: false
          },
          update: {
            quantity: {
              increment: quantity
            }
          }
        });
      }, {
        timeout: 10000 // Increase timeout to 10 seconds
      });

      // Invalidate all caches
      await this.invalidateAllCaches(characterId);
    } catch (error) {
      this.logger.error('Error adding items:', error);
      throw error;
    }
  }
}
