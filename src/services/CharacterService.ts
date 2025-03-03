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
  TransactionType
} from '@/types/game';
import { Message, EmbedBuilder, ChatInputCommandInteraction, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, StringSelectMenuInteraction, ButtonInteraction } from 'discord.js';
import { checkCooldown, setCooldown, getRemainingCooldown } from '@/utils/cooldown';
import { createEphemeralReply } from '@/utils/helpers';
import { getMentorEmoji } from '@/commands/basic/handlers/utils';
import { BattleService } from './BattleService';
import { InventoryService } from './InventoryService';

export type InteractionHandler = (source: Message | ChatInputCommandInteraction) => Promise<unknown>;

export interface ICharacterService {
  handleProfile: InteractionHandler;
  handleBalance: InteractionHandler;
  handleHunt: InteractionHandler;
  handleDaily: InteractionHandler;
  handleHelp: InteractionHandler;
  handleSell: (source: Message | ChatInputCommandInteraction, args?: string[]) => Promise<unknown>;
  handleLeaderboard: (source: Message | ChatInputCommandInteraction, type?: string) => Promise<unknown>;
}

// Update BuffType interface
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

export class CharacterService extends BaseService implements ICharacterService {
  private battleService: BattleService | null = null;
  private inventoryService: InventoryService | null = null;

  constructor(prisma: PrismaClient) {
    super(prisma);
    this.inventoryService = new InventoryService(prisma, this);
  }

  setBattleService(battleService: BattleService) {
    this.battleService = battleService;
  }

  async createCharacter(dto: CreateCharacterDto): Promise<Character> {
    try {
      const { discordId, name, mentor } = dto;

      const existingUser = await this.prisma.user.findUnique({
        where: { discordId },
        include: { character: true },
      });

      if (existingUser?.character) {
        throw new Error('Character already exists');
      }

      // Validate mentor type
      this.validateMentor(mentor);

      // Initialize empty status effects and buffs
      const initialStatusEffects: StatusEffects = { effects: [] };
      const initialActiveBuffs: ActiveBuffs = { 
        buffs: [{
          type: 'ALL',
          value: 15, // Base stat boost
          duration: 7 * 24 * 60 * 60, // 7 days in seconds
          expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days from now
          source: 'newbie_bonus'
        }]
      };

      // Calculate base stats with newbie bonus
      let attack = CONFIG.STARTER_STATS.ATTACK + 15; // Increased base attack
      let defense = CONFIG.STARTER_STATS.DEFENSE + 20; // Increased base defense
      let health = CONFIG.STARTER_STATS.HEALTH + 50; // Increased base health
      let speed = CONFIG.STARTER_STATS.SPEED + 10; // Increased base speed
      
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

      // Create character in transaction with starter items
      const result = await this.prisma.$transaction(async (tx) => {
        // Create user if not exists
        const user = await tx.user.upsert({
          where: { discordId },
          update: {},
          create: { discordId }
        });

        // Create character
        const character = await tx.character.create({
          data: {
            name,
            mentor,
            level: 1,
            experience: 0,
            health,
            maxHealth: health,
            attack,
            defense,
            speed,
            currentIsland: 'starter_island' as LocationId,
            statusEffects: JSON.stringify(initialStatusEffects),
            activeBuffs: JSON.stringify(initialActiveBuffs),
            combo: 0,
            questPoints: 0,
            explorationPoints: 0,
            luffyProgress: 0,
            zoroProgress: 0,
            usoppProgress: 0,
            sanjiProgress: 0,
            dailyHealCount: 0,
            userId: user.id,
            coins: 1000, // Starting coins for new players
            bank: 500 // Starting bank balance for new players
          }
        });

        // Add starter items to inventory
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
          },
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
        const missingItems = starterItems.filter(item => !existingItemIds.has(item.itemId));

        if (missingItems.length > 0) {
          console.warn('Some starter items are missing:', {
            missingItems: missingItems.map(item => item.itemId)
          });
        }

        // Only add items that exist in the database
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

      return result;
    } catch (error) {
      return this.handleError(error, 'CreateCharacter');
    }
  }

  async getCharacterByDiscordId(discordId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { discordId },
        include: { character: true }
      });

      return user?.character || null;
    } catch (error) {
      return this.handleError(error, 'GetCharacterByDiscordId');
    }
  }

  async getCharacterStats(characterId: string): Promise<CharacterStats> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) {
        throw new Error('Character not found');
      }

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
      select: { level: true, experience: true }
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
      // Get user and character
      const user = await this.prisma.user.findUnique({
        where: { discordId },
        include: { character: true }
      });

      if (!user || !user.character) {
        throw new Error('Karakter tidak ditemukan');
      }

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
    } catch (error) {
      return this.handleError(error, 'ResetCharacter');
    }
  }

  private validateMentor(mentor: string): asserts mentor is MentorType {
    if (!['YB', 'Tierison', 'LYuka', 'GarryAng'].includes(mentor)) {
      throw new Error(`Invalid mentor type: ${mentor}`);
    }
  }

  async addCoins(characterId: string, amount: number, type: TransactionType, description: string) {
    // Single transaction for better performance
    await this.prisma.character.update({
        where: { id: characterId },
        data: { coins: { increment: amount } }
      });
  }

  async removeCoins(characterId: string, amount: number, type: TransactionType, description: string) {
    // Single transaction for better performance
    await this.prisma.character.update({
        where: { id: characterId },
        data: { coins: { decrement: amount } }
      });
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
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) {
        throw new Error('Character not found');
      }

      return {
        coins: Number(character.coins),
        bank: Number(character.bank)
      };
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
    console.error(`Error in ${context}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return source instanceof Message 
      ? source.reply(`❌ Error: ${errorMessage}`)
      : source.reply(createEphemeralReply({ content: `❌ Error: ${errorMessage}` }));
  }

  // Utility method to get user ID from source
  private getUserId(source: Message | ChatInputCommandInteraction): string {
    return source instanceof Message ? source.author.id : source.user.id;
  }

  // Utility method to validate character
  private async validateCharacter(userId: string, source: Message | ChatInputCommandInteraction): Promise<Character | null> {
    const character = await this.getCharacterByDiscordId(userId);
    if (!character) {
      const message = '❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.';
      await (source instanceof Message 
        ? source.reply(message)
        : source.reply(createEphemeralReply({ content: message })));
      return null;
    }
    return character;
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
      const embed = await this.createBalanceEmbed(userId);
      return this.sendEmbedResponse(source, embed);
    } catch (error) {
      return this.handleCommandError(error, source, 'handleBalance');
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
        const message = `⏰ Daily reward sedang cooldown!\nTunggu ${hours}h ${minutes}m lagi.`;
        return source instanceof Message 
          ? source.reply(message)
          : source.reply(createEphemeralReply({ content: message }));
      }

      const character = await this.validateCharacter(userId, source);
      if (!character) return;

      // Calculate and apply rewards
      const exp = 100 + Math.floor(Math.random() * 50);
      const coins = 100 + Math.floor(Math.random() * 100);
      
      await this.addExperience(character.id, exp);
      await this.addCoins(character.id, coins, 'DAILY', 'Daily reward');
      
      const embed = new EmbedBuilder()
        .setTitle('🎁 Daily Rewards')
        .setColor('#00ff00')
        .setDescription('Kamu telah mengklaim hadiah harian!')
        .addFields(
          { name: '✨ Experience', value: `+${exp} EXP`, inline: true },
          { name: '💰 Coins', value: `+${coins} coins`, inline: true }
        );

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
      const result = await this.battleService.processBattle(character.id, character.level);

      // Create battle result embed
      const embed = new EmbedBuilder()
        .setColor(result.won ? '#00ff00' : '#ff0000')
        .setTitle(`⚔️ Battle Result: ${character.name}`)
        .setDescription(result.battleLog.join('\n'))
        .setFooter({ text: result.won ? '🎉 Victory!' : '💀 Defeat...' });

      // Send the response with ephemeral: false to make it visible to everyone
      if (source instanceof Message) {
        return source.reply({ embeds: [embed] });
      } else {
        return source.reply({ embeds: [embed], ephemeral: false });
      }
    } catch (error) {
      return this.handleCommandError(error, source, 'Hunt');
    }
  }

  async handleHelp(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    try {
      const embed = new EmbedBuilder()
        .setTitle('📚 Game Commands Help')
        .setColor('#0099ff')
        .setDescription('Here are all the available commands:')
        .addFields(
          { name: '🎮 Basic Commands', value: 
            '`/start` - Create your character\n' +
            '`/profile` - View your character stats\n' +
            '`/balance` - Check your coins and bank balance\n' +
            '`/daily` - Claim daily rewards'
          },
          { name: '⚔️ Battle Commands', value:
            '`/hunt` - Hunt monsters for exp and coins\n' +
            '`/heal` - Heal your character\n' +
            '`/duel` - Challenge other players'
          },
          { name: '💰 Economy Commands', value:
            '`/deposit` - Deposit coins to bank\n' +
            '`/withdraw` - Withdraw coins from bank\n' +
            '`/transfer` - Transfer coins to other players'
          }
        );

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
}
