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

// Add back the BuffType interface at the top with other interfaces
interface BuffType {
  type: string;
  stats?: {
    attack?: number;
    defense?: number;
    speed?: number;
    [key: string]: number | undefined;
  };
  multipliers?: {
    damage?: number;
    defense?: number;
    exp?: number;
    drops?: number;
    healing?: number;
  };
  expiresAt: number;
}

export type InteractionHandler = (source: Message | ChatInputCommandInteraction) => Promise<unknown>;

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

export class CharacterService extends BaseService implements ICharacterService {
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

  async createCharacter(dto: CreateCharacterDto): Promise<Character> {
    try {
      // Validate mentor
      this.validateMentor(dto.mentor);

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
      // Check cache first
      const cacheKey = `discord_${discordId}`;
      const cachedCharacter = this.characterCache.get(cacheKey);
      if (cachedCharacter) {
        // Verify cached character still exists in DB
        const dbCharacter = await this.prisma.character.findUnique({
          where: { id: cachedCharacter.id }
        });
        
        if (!dbCharacter) {
          this.characterCache.delete(cacheKey);
          return null;
        }
        
        return cachedCharacter;
      }

      const user = await this.prisma.user.findUnique({
        where: { discordId },
        include: { character: true }
      });

      if (user?.character) {
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

  private calculateExpNeeded(level: number): number {
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

  private calculateStatGains(currentLevel: number, levelsGained: number): {
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

  private validateMentor(mentor: string): asserts mentor is MentorType {
    if (!['YB', 'Tierison', 'LYuka', 'GarryAng'].includes(mentor)) {
      throw new Error(`Invalid mentor type: ${mentor}`);
    }
  }

  async addCoins(characterId: string, amount: number, type: TransactionType, description: string) {
    await this.prisma.character.update({
      where: { id: characterId },
      data: { coins: { increment: amount } }
    });
    // Invalidate balance cache
    this.balanceCache.delete(characterId);
    this.statsCache.delete(characterId);
  }

  async removeCoins(characterId: string, amount: number, type: TransactionType, description: string) {
    await this.prisma.character.update({
      where: { id: characterId },
      data: { coins: { decrement: amount } }
    });
    // Invalidate balance cache
    this.balanceCache.delete(characterId);
    this.statsCache.delete(characterId);
  }

  async transferCoins(senderId: string, receiverId: string, amount: number) {
    return this.prisma.$transaction(async (prisma) => {
      // Remove from sender
      await prisma.character.update({
        where: { id: senderId },
        data: { coins: { decrement: amount } }
      });

      // Add to receiver
      await prisma.character.update({
        where: { id: receiverId },
        data: { coins: { increment: amount } }
      });

      // Create transactions
      await prisma.transaction.create({
        data: {
          characterId: senderId,
          type: 'TRANSFER',
          amount: -amount,
          description: `Transfer to ${receiverId}`
        }
      });
      await prisma.transaction.create({
        data: {
          characterId: receiverId,
          type: 'TRANSFER',
          amount: amount,
          description: `Transfer from ${senderId}`
        }
      });
    });
  }

  async depositToBank(characterId: string, amount: number): Promise<void> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');
      if (character.coins < amount) throw new Error('Insufficient coins');

      await this.prisma.$transaction([
        // Remove from coins
        this.prisma.character.update({
          where: { id: characterId },
          data: {
            coins: { decrement: amount },
            bank: { increment: amount }
          }
        }),
        // Create transaction record
        this.prisma.transaction.create({
          data: {
            characterId,
            type: 'BANK_DEPOSIT',
            amount,
            description: `Deposited ${amount} coins to bank`
          }
        })
      ]);
    } catch (error) {
      return this.handleError(error, 'DepositToBank');
    }
  }

  async withdrawFromBank(characterId: string, amount: number): Promise<void> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');
      if (character.bank < amount) throw new Error('Insufficient bank balance');

      await this.prisma.$transaction([
        // Add to coins
        this.prisma.character.update({
          where: { id: characterId },
          data: {
            coins: { increment: amount },
            bank: { decrement: amount }
          }
        }),
        // Create transaction record
        this.prisma.transaction.create({
          data: {
            characterId,
            type: 'BANK_WITHDRAW',
            amount: -amount,
            description: `Withdrew ${amount} coins from bank`
          }
        })
      ]);
    } catch (error) {
      return this.handleError(error, 'WithdrawFromBank');
    }
  }

  async updateGamblingStats(characterId: string, bet: number, won: boolean): Promise<void> {
    try {
      await this.prisma.character.update({
        where: { id: characterId },
        data: {
          totalGambled: { increment: bet },
          totalWon: won ? { increment: bet * 2 } : undefined,
          lastGambleTime: new Date()
        }
      });
    } catch (error) {
      return this.handleError(error, 'UpdateGamblingStats');
    }
  }

  async updateBattleStats(characterId: string, won: boolean): Promise<void> {
    // Single update with minimal fields
        await this.prisma.character.update({
          where: { id: characterId },
          data: {
        wins: won ? { increment: 1 } : undefined,
        losses: !won ? { increment: 1 } : undefined,
        winStreak: won ? { increment: 1 } : 0
      }
    });
  }

  async getBalance(characterId: string): Promise<{ coins: number; bank: number }> {
    try {
      // Check cache first
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

      // Cache the balance
      this.balanceCache.set(characterId, balance);

      return balance;
    } catch (error) {
      return this.handleError(error, 'GetBalance');
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
      return this.handleError(error, 'GetTransactionHistory');
    }
  }

  private getMentorEmoji(mentorType: MentorType | undefined): string {
    if (!mentorType) return '👨‍🏫';
    
    switch(mentorType) {
      case 'YB':
        return '🏴‍☠️';
      case 'Tierison':
        return '⚔️';
      case 'LYuka':
        return '🎯';
      case 'GarryAng':
        return '🔥';
      default:
        return '👨‍🏫';
    }
  }

  private async createProfileEmbed(userId: string) {
    const character = await this.getCharacterByDiscordId(userId);
    
    if (!character) {
      throw new Error('❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.');
    }

    const stats = await this.getCharacterStats(character.id);
    const balance = await this.getBalance(character.id);

    // Get equipped items
    const inventory = await this.prisma.inventory.findMany({
      where: {
        characterId: character.id,
        isEquipped: true
      },
      include: {
        item: true
      }
    });

    // Calculate total bonus stats from equipment
    let equipmentStats = {
      attack: 0,
      defense: 0,
      speed: 0
    };

    const equippedItems = inventory.map(inv => {
      const effect = JSON.parse(inv.item.effect);
      if (effect.stats) {
        equipmentStats.attack += effect.stats.attack || 0;
        equipmentStats.defense += effect.stats.defense || 0;
        equipmentStats.speed += effect.stats.speed || 0;
      }
      
      let durabilityText = '';
      if (inv.durability !== null) {
        const maxDurability = inv.item.maxDurability || 100;
        durabilityText = ` [${inv.durability}/${maxDurability}]`;
      }
      
      return `${inv.item.name} (${inv.item.type})${durabilityText}`;
    });

    // Parse active buffs and calculate buff stats
    let activeBuffs: BuffType[] = [];
    let buffStats = {
      attack: 0,
      defense: 0,
      speed: 0
    };

    try {
      const buffs = JSON.parse(character.activeBuffs);
      if (buffs && Array.isArray(buffs.buffs)) {
        activeBuffs = buffs.buffs.filter((buff: BuffType) => buff.expiresAt > Date.now());
        
        // Calculate total stats from buffs
        activeBuffs.forEach((buff: BuffType) => {
          if (buff.stats) {
            buffStats.attack += buff.stats.attack || 0;
            buffStats.defense += buff.stats.defense || 0;
            buffStats.speed += buff.stats.speed || 0;
          }
        });
      }
    } catch (error) {
      console.error('Error parsing active buffs:', error);
      activeBuffs = [];
    }

    // Calculate total stats (base + equipment + buffs)
    const totalStats = {
      attack: stats.attack + equipmentStats.attack + buffStats.attack,
      defense: stats.defense + equipmentStats.defense + buffStats.defense,
      speed: stats.speed + equipmentStats.speed + buffStats.speed
    };

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${character.name}'s Profile`)
      .setColor('#0099ff')
      .addFields(
        { 
          name: '📈 Level & Experience', 
          value: `Level: ${stats.level}\nEXP: ${stats.experience}/${this.calculateExpNeeded(stats.level)}`,
          inline: true 
        },
        {
          name: '❤️ Health',
          value: `${stats.health}/${stats.maxHealth} HP`,
          inline: true
        },
        { 
          name: '💰 Balance', 
          value: `Coins: ${balance.coins}\nBank: ${balance.bank}`,
          inline: true 
        }
      );

    // Add combat stats with equipment and buff bonuses
    embed.addFields({
      name: '⚔️ Combat Stats',
      value: [
        `💪 Attack: ${stats.attack} (Base) + ${equipmentStats.attack} (Equipment) + ${buffStats.attack} (Buffs) = ${totalStats.attack}`,
        `🛡️ Defense: ${stats.defense} (Base) + ${equipmentStats.defense} (Equipment) + ${buffStats.defense} (Buffs) = ${totalStats.defense}`,
        `💨 Speed: ${stats.speed} (Base) + ${equipmentStats.speed} (Equipment) + ${buffStats.speed} (Buffs) = ${totalStats.speed}`,
        `🎯 Wins/Losses: ${stats.wins}/${stats.losses}`,
        `🔥 Win Streak: ${stats.winStreak} (Highest: ${stats.highestStreak})`,
        `⚔️ Hunt Streak: ${stats.huntStreak} (Highest: ${stats.highestHuntStreak})`
      ].join('\n'),
      inline: false
    });

    // Add equipment section if any items equipped
    if (equippedItems.length > 0) {
      embed.addFields({
        name: '🎽 Equipment',
        value: equippedItems.join('\n'),
        inline: true
      });

      // Add total equipment bonus
      embed.addFields({
        name: '🔧 Equipment Bonus',
        value: [
          `⚔️ Attack: +${equipmentStats.attack}`,
          `🛡️ Defense: +${equipmentStats.defense}`,
          `💨 Speed: +${equipmentStats.speed}`
        ].join('\n'),
        inline: true
      });
    }

    // Add active buffs section if any
    if (activeBuffs.length > 0) {
      const buffsList = activeBuffs.map(buff => {
        const duration = Math.ceil((buff.expiresAt - Date.now()) / 1000 / 60); // minutes
        const buffName = this.getBuffName(buff.type);
        const emoji = this.getBuffEmoji(buff.type);
        
        // Format stats and multipliers
        const parts = [];
        
        // Handle base stats
        if (buff.stats) {
          const validStats = Object.entries(buff.stats)
            .filter(([_, value]) => value !== undefined && value !== null && value !== 0)
            .map(([stat, value]) => `${stat.charAt(0).toUpperCase() + stat.slice(1)}: +${value}`)
            .join(', ');
          if (validStats) {
            parts.push(validStats);
          }
        }
        
        // Handle multipliers
        if (buff.multipliers) {
          const validMultipliers = Object.entries(buff.multipliers)
            .filter(([_, value]) => value !== undefined && value !== null && value !== 1)
            .map(([stat, value]) => {
              const percent = ((value - 1) * 100).toFixed(0);
              return `${stat.charAt(0).toUpperCase() + stat.slice(1)}: +${percent}%`;
            })
            .join(', ');
          if (validMultipliers) {
            parts.push(validMultipliers);
          }
        }
        
        const statsText = parts.length > 0 ? ` (${parts.join(' | ')})` : '';
        return `${emoji} ${buffName}${statsText} (${duration}m)`;
      }).join('\n');

      embed.addFields({
        name: '⚡ Active Buffs',
        value: buffsList || 'Tidak ada buff aktif',
        inline: false
      });
    }

    // Add mentor info if exists
    if (stats.mentor) {
      embed.addFields({
        name: '👨‍🏫 Mentor',
        value: `${this.getMentorEmoji(stats.mentor)} ${stats.mentor}`,
        inline: true
      });
    }

    // Add progress section
    embed.addFields({
      name: '📊 Progress',
      value: [
        `🎯 Quest Points: ${stats.questPoints}`,
        `🗺️ Exploration: ${stats.explorationPoints}`,
        `${this.getMentorEmoji(stats.mentor)} Mentor Progress: ${this.getMentorProgress(stats)}`
      ].join('\n'),
      inline: false
    });

    return embed;
  }

  private getBuffName(type: string): string {
    // Handle undefined or null type
    if (!type) {
      return 'Unknown Buff';
    }

    // Handle item-based buff types
    if (type.includes('_')) {
      const parts = type.split('_');
      const itemName = parts.map(part => part.charAt(0) + part.slice(1).toLowerCase()).join(' ');
      return itemName;
    }

    const buffNames: Record<string, string> = {
      'ATTACK': 'Attack Boost',
      'DEFENSE': 'Defense Boost',
      'SPEED': 'Speed Boost',
      'ALL': 'Full Power',
      'HEAL': 'Regeneration',
      'HEAL_OVER_TIME': 'Healing',
      'BURN': 'Burning',
      'POISON': 'Poisoned',
      'STUN': 'Stunned',
      'DAMAGE': 'Damage Boost',
      'EXP': 'Experience Boost',
      'DROPS': 'Drop Rate Boost',
      'HEALING': 'Healing Boost',
      'RUMBLE_BALL': 'Rumble Ball',
      'SUPER_MEAT': 'Super Meat',
      'CRITICAL': 'Critical Boost',
      'COMBO': 'Combo Boost',
      'GEAR_SECOND': 'Gear Second',
      'TRAINING': 'Training Boost',
      'MENTOR': 'Mentor Boost',
      'FOOD': 'Food Boost',
      'EXPLORATION': 'Explorer Boost',
      'QUEST': 'Quest Boost',
      'BATTLE': 'Battle Boost'
    };

    return buffNames[type] || 'Unknown Buff';
  }

  private getBuffEmoji(type: string): string {
    const emojis: Record<string, string> = {
      'ATTACK': '⚔️',
      'DEFENSE': '🛡️',
      'SPEED': '💨',
      'ALL': '💫',
      'HEAL': '❤️',
      'HEAL_OVER_TIME': '💚',
      'BURN': '🔥',
      'POISON': '☠️',
      'STUN': '⚡',
      'DAMAGE': '🗡️',
      'EXP': '✨',
      'DROPS': '💎',
      'HEALING': '💖',
      'RUMBLE_BALL': '💊',
      'SUPER_MEAT': '🍖',
      'CRITICAL': '🎯',
      'COMBO': '🔄',
      'GEAR_SECOND': '🔧',
      'TRAINING': '🏋️',
      'MENTOR': '👨‍🏫',
      'FOOD': '🍖',
      'EXPLORATION': '🗺️',
      'QUEST': '📚',
      'BATTLE': '⚔️'
    };
    return emojis[type] || '⚡';
  }

  private getMentorProgress(stats: any): string {
    switch(stats.mentor) {
      case 'YB':
        return `${stats.luffyProgress}/100`;
      case 'Tierison':
        return `${stats.zoroProgress}/100`;
      case 'LYuka':
        return `${stats.usoppProgress}/100`;
      case 'GarryAng':
        return `${stats.sanjiProgress}/100`;
      default:
        return '0/100';
    }
  }

  private async createBalanceEmbed(userId: string) {
    const character = await this.getCharacterByDiscordId(userId);
    
    if (!character) {
      throw new Error('❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.');
    }

    const balance = await this.getBalance(character.id);
    const history = await this.getTransactionHistory(character.id, 5);

    const embed = new EmbedBuilder()
      .setTitle('💰 Balance')
      .setColor('#ffd700')
      .addFields(
        { name: 'Coins', value: `${balance.coins}`, inline: true },
        { name: 'Bank', value: `${balance.bank}`, inline: true },
        { name: 'Total', value: `${balance.coins + balance.bank}`, inline: true }
      );

    if (history.length > 0) {
      const historyText = history
        .map(t => `${t.type}: ${t.amount > 0 ? '+' : ''}${t.amount} (${t.description})`)
        .join('\n');
      embed.addFields({ name: 'Recent Transactions', value: historyText });
    }

    return embed;
  }

  // Utility method to handle command errors
  private async handleCommandError(error: unknown, source: Message | ChatInputCommandInteraction, context: string): Promise<unknown> {
    return ErrorUtils.handleError({
      context,
      error,
      source
    });
  }

  // Utility method to get user ID from source
  private getUserId(source: Message | ChatInputCommandInteraction): string {
    return source instanceof Message ? source.author.id : source.user.id;
  }

  // Utility method to validate character
  private async validateCharacter(userId: string, source: Message | ChatInputCommandInteraction): Promise<Character | null> {
    try {
      // Clear cache first to ensure fresh data
      const cacheKey = `discord_${userId}`;
      this.characterCache.delete(cacheKey);
      
      // Get character with fresh data
      const character = await this.getCharacterByDiscordId(userId);
      
      if (!character) {
        await ErrorUtils.handleCharacterNotFound(source);
        return null;
      }

      // Validate character exists in database
      const dbCharacter = await this.prisma.character.findUnique({
        where: { id: character.id }
      });

      if (!dbCharacter) {
        // Clear all caches if character exists in cache but not in DB
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

  // Utility method to send embed response
  private async sendEmbedResponse(source: Message | ChatInputCommandInteraction, embed: EmbedBuilder): Promise<unknown> {
    if (source instanceof Message) {
      return source.reply({ embeds: [embed] });
    } else {
      // Handle different interaction states
      if (source.deferred) {
        return source.editReply({ embeds: [embed] });
      } else if (source.replied) {
        return source.followUp({ embeds: [embed], ephemeral: true });
      } else {
        return source.reply({ embeds: [embed], ephemeral: true });
      }
    }
  }

  // Refactored command handlers
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

  async handleDaily(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    try {
      const userId = this.getUserId(source);
      
      // Check cooldown
      if (!checkCooldown(userId, 'daily')) {
        const remainingTime = getRemainingCooldown(userId, 'daily');
        const hours = Math.floor(remainingTime / 3600);
        const minutes = Math.floor((remainingTime % 3600) / 60);
        return ErrorUtils.handleCooldown(source, `${hours}h ${minutes}m`);
      }

      const character = await this.validateCharacter(userId, source);
      if (!character) return;

      // Calculate and apply rewards
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

  async handleHunt(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    try {
      const userId = this.getUserId(source);
      const character = await this.validateCharacter(userId, source);
      if (!character) return;

      // Ensure battle service is initialized
      if (!this.battleService) {
        throw new Error('Battle service not initialized');
      }

      // Process the battle
      const response = await this.battleService.processBattle(character.id, character.level);

      // Send the response with ephemeral: false to make it visible to everyone
      if (source instanceof Message) {
        return source.reply({ embeds: [response.embed] });
      } else {
        return source.reply({ embeds: [response.embed], ephemeral: false });
      }
    } catch (error) {
      return ErrorUtils.handleCombatError(source, error);
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

      // Implement sell logic here
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
      // Get page number from options if it exists
      let currentPage = source instanceof ChatInputCommandInteraction 
        ? (source.options.getInteger('page') || 1)
        : 1;
      
      // Default to level leaderboard if no type specified
      type = type?.toLowerCase() || 'level';

      const itemsPerPage = 10;

      // Function to generate leaderboard embed and components
      const generateLeaderboard = async (page: number) => {
        const skip = (page - 1) * itemsPerPage;

        let orderBy: any;
        let title: string;
        let valueFormatter: (value: any) => string;
        let description: string;

        switch (type) {
          case 'level':
            orderBy = { level: 'desc' };
            title = '🏆 Level Leaderboard';
            description = 'Top players by level';
            valueFormatter = (value: number) => `Level ${value}`;
            break;
          case 'coins':
          case 'money':
            orderBy = { coins: 'desc' };
            title = '💰 Richest Players';
            description = 'Top players by coins';
            valueFormatter = (value: bigint) => `${value} coins`;
            break;
          case 'bank':
            orderBy = { bank: 'desc' };
            title = '🏦 Bank Leaderboard';
            description = 'Top players by bank balance';
            valueFormatter = (value: bigint) => `${value} coins`;
            break;
          case 'streak':
          case 'huntstreak':
            orderBy = { huntStreak: 'desc' };
            title = '🔥 Highest Hunt Streaks';
            description = 'Top players by hunt streak';
            valueFormatter = (value: number) => `${value} streak`;
            break;
          case 'highstreak':
            orderBy = { highestHuntStreak: 'desc' };
            title = '👑 All-Time Highest Streaks';
            description = 'Top players by highest hunt streak achieved';
            valueFormatter = (value: number) => `${value} streak`;
            break;
          case 'wins':
            orderBy = { wins: 'desc' };
            title = '⚔️ Most Wins';
            description = 'Top players by battle wins';
            valueFormatter = (value: number) => `${value} wins`;
            break;
          case 'winrate':
            orderBy = [
              { wins: 'desc' },
              { losses: 'asc' }
            ];
            title = '🎯 Best Win Rate';
            description = 'Top players by win/loss ratio';
            valueFormatter = (char: any) => `${((char.wins / (char.wins + char.losses)) * 100).toFixed(1)}% (${char.wins}W/${char.losses}L)`;
            break;
          case 'gambled':
            orderBy = { totalGambled: 'desc' };
            title = '🎲 Biggest Gamblers';
            description = 'Top players by total amount gambled';
            valueFormatter = (value: bigint) => `${value} coins`;
            break;
          case 'won':
            orderBy = { totalWon: 'desc' };
            title = '🎰 Luckiest Players';
            description = 'Top players by total gambling winnings';
            valueFormatter = (value: bigint) => `${value} coins`;
            break;
          default:
            return null;
        }

        // Get total count for pagination
        const totalCount = await this.prisma.character.count({
          where: type === 'winrate' ? { wins: { gt: 0 } } : undefined
        });
        
        const totalPages = Math.ceil(totalCount / itemsPerPage);

        // Validate page number
        if (page < 1 || page > totalPages) {
          return null;
        }

        // Get characters for current page
        const characters = await this.prisma.character.findMany({
          take: itemsPerPage,
          skip,
          orderBy,
          where: type === 'winrate' ? { wins: { gt: 0 } } : undefined,
          select: {
            name: true,
            level: true,
            coins: true,
            bank: true,
            huntStreak: true,
            highestHuntStreak: true,
            wins: true,
            losses: true,
            totalGambled: true,
            totalWon: true,
            user: {
              select: {
                discordId: true
              }
            }
          }
        });

        if (characters.length === 0) {
          return null;
        }

        const embed = new EmbedBuilder()
          .setTitle(title)
          .setColor('#FFD700')
          .setDescription(description)
          .addFields({
            name: `Rankings (Page ${page}/${totalPages})`,
            value: characters.map((char, index) => {
              const position = skip + index + 1;
              const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '🏅';
              const value = type === 'level' ? char.level :
                           type === 'coins' || type === 'money' ? char.coins :
                           type === 'bank' ? char.bank :
                           type === 'streak' || type === 'huntstreak' ? char.huntStreak :
                           type === 'highstreak' ? char.highestHuntStreak :
                           type === 'winrate' ? char :
                           type === 'gambled' ? char.totalGambled :
                           type === 'won' ? char.totalWon :
                           char.wins;
              return `${medal} ${position}. ${char.name} - ${valueFormatter(value)}`;
            }).join('\n')
          })
          .setFooter({ text: `Page ${page}/${totalPages} • Use /leaderboard <type> <page>` })
          .setTimestamp();

        // Create navigation buttons
        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`prev_${type}`)
              .setLabel('Previous')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(page <= 1),
            new ButtonBuilder()
              .setCustomId(`next_${type}`)
              .setLabel('Next')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(page >= totalPages)
          );

        return { embed, components: [row], totalPages };
      };

      // Generate initial leaderboard
      const initial = await generateLeaderboard(currentPage);
      if (!initial) {
        return source.reply({
          content: '❌ Invalid leaderboard type or no data found! Available types:\n' +
                  '• level - Top players by level\n' +
                  '• coins/money - Richest players\n' +
                  '• bank - Highest bank balances\n' +
                  '• streak/huntstreak - Current hunt streaks\n' +
                  '• highstreak - All-time highest streaks\n' +
                  '• wins - Most battle wins\n' +
                  '• winrate - Best win/loss ratio\n' +
                  '• gambled - Most coins gambled\n' +
                  '• won - Most gambling winnings',
          ephemeral: true
        });
      }

      // Send initial message and get the message object for collector
      let messageToCollectFrom: Message;
      if (source instanceof Message) {
        const reply = await source.reply({ 
          embeds: [initial.embed], 
          components: initial.components,
        });
        messageToCollectFrom = reply as Message;
      } else {
        const reply = await source.reply({ 
          embeds: [initial.embed], 
          components: initial.components, 
          ephemeral: false, 
        });
        messageToCollectFrom = reply as unknown as Message;
      }

      // Create button collector
      const collector = messageToCollectFrom.createMessageComponentCollector({ 
        componentType: ComponentType.Button,
        time: 300000 // 5 minutes
      });

      collector.on('collect', async (interaction: ButtonInteraction) => {
        // Verify the user who clicked is the one who ran the command
        if (interaction.user.id !== (source instanceof Message ? source.author.id : source.user.id)) {
          await interaction.reply({
            content: '❌ Only the person who ran this command can use these buttons!',
            ephemeral: true
          });
          return;
        }

        // Handle navigation
        if (interaction.customId === `prev_${type}`) {
          currentPage--;
        } else if (interaction.customId === `next_${type}`) {
          currentPage++;
        }

        // Generate new leaderboard
        const updated = await generateLeaderboard(currentPage);
        if (!updated) {
          await interaction.reply({
            content: '❌ Failed to load leaderboard page.',
            ephemeral: true
          });
          return;
        }

        // Update the message
        await interaction.update({
          embeds: [updated.embed],
          components: updated.components
        });
      });

      collector.on('end', () => {
        // Remove buttons when collector expires
        if (messageToCollectFrom.editable) {
          messageToCollectFrom.edit({ components: [] }).catch(() => {});
        }
      });

      return messageToCollectFrom;
    } catch (error) {
      return this.handleCommandError(error, source, 'handleLeaderboard');
    }
  }

  async addItems(characterId: string, itemId: string, quantity: number): Promise<void> {
    try {
      // Check if item exists in inventory
      const existingItem = await this.prisma.inventory.findUnique({
        where: {
          characterId_itemId: {
            characterId,
            itemId
          }
        }
      });

      if (existingItem) {
        // Update existing item quantity
        await this.prisma.inventory.update({
          where: {
            characterId_itemId: {
              characterId,
              itemId
            }
          },
          data: {
            quantity: { increment: quantity }
          }
        });
      } else {
        // Create new inventory entry
        await this.prisma.inventory.create({
          data: {
            characterId,
            itemId,
            quantity,
            isEquipped: false
          }
        });
      }
    } catch (error) {
      this.logger.error('Error adding items:', error);
      throw error;
    }
  }

  async handleStart(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    try {
      const userId = source instanceof Message ? source.author.id : source.user.id;
      
      // Check if character already exists
      const existingCharacter = await this.getCharacterByDiscordId(userId);
      if (existingCharacter) {
        return source.reply({
          content: source instanceof Message ? 
            '❌ Kamu sudah memiliki karakter! Gunakan `a p` untuk melihat karaktermu.' :
            '❌ Kamu sudah memiliki karakter! Gunakan `/profile` untuk melihat karaktermu.',
          ephemeral: source instanceof ChatInputCommandInteraction
        });
      }

      // For message commands, show instructions
      if (source instanceof Message) {
        // Create help embed
        const embed = new EmbedBuilder()
          .setTitle('🎮 Buat Karakter Baru')
          .setDescription('Untuk membuat karakter baru, gunakan command:\n`a start <nama> <mentor>`\n\nContoh:\n`a start AmangLy YB`\n\nPilih mentor yang sesuai dengan gaya bermainmu:')
          .addFields(
            { 
              name: '🏴‍☠️ YB (Luffy)',
              value: '+15% Attack, -10% Defense, +10% Health, +20% Speed\nCocok untuk pemain agresif yang suka menyerang.',
              inline: true
            },
            {
              name: '⚔️ Tierison (Zoro)',
              value: '+10% Attack, +10% Defense, +10% Speed\nSeimbang untuk semua situasi.',
              inline: true
            },
            {
              name: '🎯 LYuka (Usopp)',
              value: '-10% Attack, +20% Defense, +5% Health, +15% Speed\nCocok untuk pemain yang suka bertahan.',
              inline: true
            },
            {
              name: '🔥 GarryAng (Sanji)',
              value: '+5% Attack, +15% Defense, +10% Health, +30% Speed\nCocok untuk pemain yang suka combo dan dodge.',
              inline: true
            }
          )
          .setColor('#00ff00')
          .setFooter({ text: 'Gunakan format: a start <nama> <mentor>' });

        return source.reply({ embeds: [embed] });
      }

      // For slash commands, show modal
      const modal = new ModalBuilder()
        .setCustomId('character_creation')
        .setTitle('Create Your Character');

      // Add name input
      const nameInput = new TextInputBuilder()
        .setCustomId('character_name')
        .setLabel('Pilih nama karaktermu')
        .setStyle(TextInputStyle.Short)
        .setMinLength(3)
        .setMaxLength(20)
        .setPlaceholder('Masukkan nama untuk karaktermu')
        .setRequired(true);

      // Add mentor selection
      const mentorInput = new TextInputBuilder()
        .setCustomId('mentor')
        .setLabel('Pilih mentormu')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('YB, Tierison, LYuka, atau GarryAng')
        .setRequired(true);

      // Add mentor descriptions
      const mentorDescriptions = new TextInputBuilder()
        .setCustomId('mentor_info')
        .setLabel('Info Mentor')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(
          'YB: +15% Attack, -10% Defense, +10% Health, +20% Speed\n' +
          'Tierison: +10% Attack, +10% Defense, +10% Speed\n' +
          'LYuka: -10% Attack, +20% Defense, +5% Health, +15% Speed\n' +
          'GarryAng: +5% Attack, +15% Defense, +10% Health, +30% Speed'
        )
        .setRequired(false);

      // Add components to modal
      const nameActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
      const mentorActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(mentorInput);
      const mentorInfoActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(mentorDescriptions);

      modal.addComponents(nameActionRow, mentorActionRow, mentorInfoActionRow);

      // Show modal
      await source.showModal(modal);

      // Wait for modal submission
      const filter = (i: ModalSubmitInteraction) => i.customId === 'character_creation';
      const submission = await source.awaitModalSubmit({ filter, time: 120000 });

      if (!submission) {
        return source.followUp({
          content: '❌ Pembuatan karakter timeout. Silakan coba lagi.',
          ephemeral: true
        });
      }

      // Get values from submission
      const name = submission.fields.getTextInputValue('character_name');
      const mentor = submission.fields.getTextInputValue('mentor').toUpperCase();

      // Validate mentor
      if (!['YB', 'TIERISON', 'LYUKA', 'GARRYANG'].includes(mentor)) {
        return submission.reply({
          content: '❌ Mentor tidak valid! Pilih dari: YB, Tierison, LYuka, atau GarryAng',
          ephemeral: true
        });
      }

      // Create character
      const character = await this.createCharacter({
        name,
        mentor: mentor as MentorType,
        discordId: userId
      });

      // Create welcome embed
      const embed = new EmbedBuilder()
        .setTitle('🎉 Selamat Datang di A4A Clan!')
        .setDescription(`Karaktermu berhasil dibuat!\n\nNama: ${character.name}\nMentor: ${mentor}`)
        .setColor('#00ff00')
        .addFields(
          { 
            name: '📊 Stats', 
            value: [
              `⚔️ Attack: ${character.attack}`,
              `🛡️ Defense: ${character.defense}`,
              `❤️ Health: ${character.health}`,
              `💨 Speed: ${character.speed}`
            ].join('\n'),
            inline: true 
          },
          { 
            name: '💰 Balance', 
            value: [
              `Coins: ${character.coins}`,
              `Bank: ${character.bank}`
            ].join('\n'),
            inline: true 
          },
          { 
            name: '📜 Langkah Selanjutnya', 
            value: [
              '• Gunakan `a h` untuk berburu dan mendapatkan exp',
              '• Cek profilmu dengan `a p`',
              '• Beli equipment di `a s`',
              '• Lihat inventory dengan `a i`'
            ].join('\n')
          }
        );

      return submission.reply({ embeds: [embed], ephemeral: false });
    } catch (error) {
      return this.handleCommandError(error, source, 'handleStart');
    }
  }
}
