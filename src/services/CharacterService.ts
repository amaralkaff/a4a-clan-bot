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
import { Message, EmbedBuilder, ChatInputCommandInteraction, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, StringSelectMenuInteraction } from 'discord.js';
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

      // Parse and validate status effects
      let statusEffects: StatusEffects;
      try {
        statusEffects = JSON.parse(character.statusEffects);
        if (!statusEffects || !Array.isArray(statusEffects.effects)) {
          statusEffects = { effects: [] };
        }
        // Filter out expired effects
        statusEffects.effects = statusEffects.effects.filter(effect => 
          effect && effect.duration && effect.duration > 0
        );
      } catch (error) {
        console.error('Error parsing status effects:', error);
        statusEffects = { effects: [] };
      }

      // Parse and validate active buffs
      let activeBuffs: ActiveBuffs;
      try {
        activeBuffs = JSON.parse(character.activeBuffs);
        if (!activeBuffs || !Array.isArray(activeBuffs.buffs)) {
          activeBuffs = { buffs: [] };
        }
        // Filter out expired buffs
        activeBuffs.buffs = activeBuffs.buffs.filter(buff => 
          buff && buff.expiresAt && buff.expiresAt > Date.now()
        );
      } catch (error) {
        console.error('Error parsing active buffs:', error);
        activeBuffs = { buffs: [] };
      }

      // Update character with cleaned buffs and effects
      await this.prisma.character.update({
        where: { id: characterId },
        data: {
          statusEffects: JSON.stringify(statusEffects),
          activeBuffs: JSON.stringify(activeBuffs)
        }
      });

      return {
        level: character.level,
        experience: character.experience,
        health: character.health,
        maxHealth: character.maxHealth,
        attack: character.attack,
        defense: character.defense,
        speed: character.speed,
        location: character.currentIsland as LocationId,
        mentor: character.mentor as MentorType | undefined,
        luffyProgress: character.luffyProgress,
        zoroProgress: character.zoroProgress,
        usoppProgress: character.usoppProgress,
        sanjiProgress: character.sanjiProgress,
        combo: character.combo,
        questPoints: character.questPoints,
        explorationPoints: character.explorationPoints,
        statusEffects: statusEffects.effects,
        activeBuffs: activeBuffs.buffs,
        dailyHealCount: character.dailyHealCount,
        lastHealTime: character.lastHealTime || undefined,
        lastDailyReset: character.lastDailyReset || undefined,
        coins: character.coins,
        bank: character.bank,
        totalGambled: character.totalGambled,
        totalWon: character.totalWon,
        lastGambleTime: character.lastGambleTime || undefined,
        wins: character.wins,
        losses: character.losses,
        winStreak: character.winStreak,
        highestStreak: character.highestStreak,
        huntStreak: character.huntStreak || 0,
        highestHuntStreak: character.highestHuntStreak || 0,
        lastHuntTime: character.lastHuntTime || undefined
      };
    } catch (error) {
      return this.handleError(error, 'GetCharacterStats');
    }
  }

  private calculateMaxHealth(level: number): number {
    // Balanced health scaling with smoother progression
    let baseHealth = 100; // Base health for level 1
    
    if (level >= 70) {
      // Ultimate tier (70+) - Exponential scaling for endgame
      baseHealth = 2000 + Math.pow(level, 2.2); // Smoother curve
    } else if (level >= 50) {
      // Elite tier (50-69) - Strong but not overwhelming
      baseHealth = 1500 + Math.pow(level, 2.0);
    } else if (level >= 30) {
      // Veteran tier (30-49) - Solid health pool
      baseHealth = 1000 + Math.pow(level, 1.8);
    } else if (level >= 15) {
      // Advanced tier (15-29) - Noticeable improvement
      baseHealth = 500 + Math.pow(level, 1.6);
    } else {
      // Beginner tier (1-14) - Gentle scaling for early game
      baseHealth = 100 + (level * 50) + Math.pow(level, 1.4);
    }

    return Math.floor(baseHealth);
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

  private calculateExpNeeded(level: number): number {
    // Base exp with gentler quadratic scaling
    let baseExp;
    
    if (level <= 10) {
      // Early levels (1-10): Linear scaling for gentler early game
      baseExp = Math.floor(level * 1000);
    } else if (level <= 20) {
      // Mid levels (11-20): Mild quadratic scaling
      baseExp = Math.floor(level * level * 100);
    } else if (level <= 40) {
      // High levels (21-40): Moderate quadratic scaling
      baseExp = Math.floor(level * level * 150);
    } else {
      // End game (41+): Full quadratic scaling
      baseExp = Math.floor(level * level * 200);
    }

    // Additional tier bonuses for higher levels
    if (level > 50) {
      return Math.floor(baseExp * 1.3);  // Ultimate tier
    } else if (level > 40) {
      return Math.floor(baseExp * 1.2);  // Elite tier
    } else if (level > 30) {
      return Math.floor(baseExp * 1.15); // Veteran tier
    } else if (level > 20) {
      return Math.floor(baseExp * 1.1);  // Advanced tier
    }
    return baseExp;
  }

  private calculateStatGains(currentLevel: number, levelsGained: number): {
    attack: number;
    defense: number;
    maxHealth: number;
    speed: number;
  } {
    let totalAttack = 0;
    let totalDefense = 0;
    let totalMaxHealth = 0;
    let totalSpeed = 0;

    for (let i = 0; i < levelsGained; i++) {
      const level = currentLevel + i;
      const tierMultiplier = this.getTierMultiplier(level);

      // Enhanced base stat gains with better scaling
      let attackGain = Math.floor(8 * tierMultiplier);  // Increased from 4
      let defenseGain = Math.floor(6 * tierMultiplier); // Increased from 3
      let speedGain = Math.floor(4 * tierMultiplier);   // Increased from 2

      // Enhanced bonus stats for milestone levels
      if ((level + 1) % 10 === 0) {  // Every 10 levels
        attackGain *= 2;    // 100% bonus (up from 50%)
        defenseGain *= 2;   // 100% bonus
        speedGain *= 2;     // 100% bonus
      } else if ((level + 1) % 5 === 0) {  // Every 5 levels
        attackGain *= 1.5;  // 50% bonus (up from 25%)
        defenseGain *= 1.5; // 50% bonus
        speedGain *= 1.5;   // 50% bonus
      }

      totalAttack += attackGain;
      totalDefense += defenseGain;
      totalSpeed += speedGain;
      
      // Health gains are calculated separately with enhanced values
      const prevMaxHealth = this.calculateMaxHealth(level);
      const newMaxHealth = this.calculateMaxHealth(level + 1);
      totalMaxHealth += (newMaxHealth - prevMaxHealth) * 1.5; // 50% bonus to health gains
    }

    return {
      attack: totalAttack,
      defense: totalDefense,
      maxHealth: totalMaxHealth,
      speed: totalSpeed
    };
  }

  private getTierMultiplier(level: number): number {
    if (level >= 70) return 3.5;     // Ultimate tier (up from 2.5)
    if (level >= 50) return 3.0;     // Elite tier (up from 2.0)
    if (level >= 30) return 2.5;     // Veteran tier (up from 1.6)
    if (level >= 15) return 2.0;     // Advanced tier (up from 1.3)
    if (level >= 5) return 1.5;      // Beginner tier (up from 1.1)
    return 1.2;                      // Starter tier (up from 1.0)
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
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');

      // Enhanced early game bonus with better scaling
      let expMultiplier;
      if (character.level <= 3) {
        expMultiplier = 5.0;  // 5x exp for first 3 levels
      } else if (character.level <= 5) {
        expMultiplier = 4.0;  // 4x bonus for levels 4-5
      } else if (character.level <= 10) {
        expMultiplier = 3.0;  // 3x bonus for levels 6-10
      } else if (character.level <= 15) {
        expMultiplier = 2.5;  // 2.5x bonus for levels 11-15
      } else if (character.level <= 20) {
        expMultiplier = 2.0;  // 2x bonus for levels 16-20
      } else if (character.level <= 30) {
        expMultiplier = 1.75; // 1.75x bonus for levels 21-30
      } else if (character.level <= 50) {
        expMultiplier = 1.5;  // 1.5x bonus for levels 31-50
      } else {
        expMultiplier = 1.25; // 1.25x bonus for levels 51+
      }

      // Enhanced mentor bonus
      if (character.mentor) {
        switch(character.mentor) {
          case 'YB': // Luffy - Combat focused, more exp from battles
            expMultiplier *= 1.5; // 50% more exp (up from 20%)
            break;
          case 'Tierison': // Zoro - Training focused
            expMultiplier *= 1.4; // 40% more exp (up from 15%)
            break;
          case 'LYuka': // Usopp - Strategic focus
            expMultiplier *= 1.3; // 30% more exp (up from 10%)
            break;
          case 'GarryAng': // Sanji - Balanced approach
            expMultiplier *= 1.35; // 35% more exp (up from 12%)
            break;
        }
      }

      const gainedExp = Math.floor(amount * expMultiplier);
      
      let { level, experience } = character;
      const oldLevel = level;
      let newExp = experience;
      let levelsGained = 0;

      // First check if current exp already qualifies for level up
      while (true) {
        const requiredExp = this.calculateExpNeeded(level);
        if (newExp < requiredExp) break;
        
        newExp -= requiredExp;
        level++;
        levelsGained++;
      }

      // Then add the new exp and check for additional level ups
      newExp += gainedExp;
      while (true) {
        const requiredExp = this.calculateExpNeeded(level);
        if (newExp < requiredExp) break;
        
        newExp -= requiredExp;
        level++;
        levelsGained++;
      }

      // Enhanced stat gains if leveled up
      let statsGained;
      if (levelsGained > 0) {
        statsGained = this.calculateStatGains(oldLevel, levelsGained);
        
        // Update character with new stats and heal to new max health
        await this.prisma.character.update({
          where: { id: characterId },
          data: {
            level,
            experience: newExp,
            attack: { increment: statsGained.attack },
            defense: { increment: statsGained.defense },
            maxHealth: { increment: statsGained.maxHealth },
            speed: { increment: statsGained.speed },
            health: character.maxHealth + statsGained.maxHealth // Heal to new max health on level up
          }
        });

        // Add level up bonus rewards
        if (levelsGained > 0) {
          // Bonus coins for leveling up
          const coinBonus = Math.floor(1000 * Math.pow(level, 1.2)); // Enhanced coin bonus
          await this.addCoins(characterId, coinBonus, 'LEVEL_UP', `Level up bonus (Level ${level})`);
        }

        this.logger.info(`Character ${character.name} leveled up from ${oldLevel} to ${level} (gained ${levelsGained} levels)`);
      } else {
        // Just update experience if no level up
        await this.prisma.character.update({
          where: { id: characterId },
          data: {
            experience: newExp
          }
        });
      }

      return {
        leveledUp: levelsGained > 0,
        newLevel: levelsGained > 0 ? level : undefined,
        newExp,
        levelsGained: levelsGained > 0 ? levelsGained : undefined,
        statsGained: levelsGained > 0 ? statsGained : undefined
      };
    } catch (error) {
      this.logger.error('Error in addExperience:', error);
      throw error;
    }
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
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');

      const currentEffects = JSON.parse(character.statusEffects) as StatusEffects;
      const currentBuffs = JSON.parse(character.activeBuffs) as ActiveBuffs;

      // Remove expired effects
      currentEffects.effects = currentEffects.effects.filter(effect => effect.duration > 0);

      // Remove expired buffs
      currentBuffs.buffs = currentBuffs.buffs.filter(buff => buff.expiresAt > Date.now());

      await this.prisma.character.update({
        where: { id: characterId },
        data: {
          statusEffects: JSON.stringify(currentEffects),
          activeBuffs: JSON.stringify(currentBuffs)
        }
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        return this.handleError(error, 'CleanupExpiredEffectsAndBuffs');
      }
      return this.handleError(new Error('Unknown error in CleanupExpiredEffectsAndBuffs'), 'CleanupExpiredEffectsAndBuffs');
    }
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
    return this.prisma.$transaction(async (prisma) => {
      const character = await prisma.character.update({
        where: { id: characterId },
        data: { coins: { increment: amount } }
      });

      await prisma.transaction.create({
        data: {
          characterId,
          type,
          amount,
          description
        }
      });

      return character.coins;
    });
  }

  async removeCoins(characterId: string, amount: number, type: TransactionType, description: string) {
    return this.prisma.$transaction(async (prisma) => {
      const character = await prisma.character.update({
        where: { id: characterId },
        data: { coins: { decrement: amount } }
      });

      await prisma.transaction.create({
        data: {
          characterId,
          type,
          amount: -amount,
          description
        }
      });

      return character.coins;
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
    try {
      if (won) {
        const character = await this.prisma.character.findUnique({
          where: { id: characterId },
          select: { winStreak: true, highestStreak: true }
        });

        if (!character) throw new Error('Character not found');

        const newStreak = character.winStreak + 1;
        const newHighestStreak = Math.max(newStreak, character.highestStreak);

        await this.prisma.character.update({
          where: { id: characterId },
          data: {
            wins: { increment: 1 },
            winStreak: newStreak,
            highestStreak: newHighestStreak
          }
        });
      } else {
        await this.prisma.character.update({
          where: { id: characterId },
          data: {
            losses: { increment: 1 },
            winStreak: 0
          }
        });
      }
    } catch (error) {
      return this.handleError(error, 'UpdateBattleStats');
    }
  }

  async getBalance(characterId: string): Promise<{ coins: number; bank: number }> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        select: {
          coins: true,
          bank: true
        }
      });

      if (!character) throw new Error('Character not found');

      return {
        coins: character.coins,
        bank: character.bank
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
        `${this.getMentorEmoji(stats.mentor as string)} Mentor Progress: ${this.getMentorProgress(stats)}`
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

      if (!this.battleService) {
        throw new Error('Battle service not initialized');
      }

      const now = new Date();
      const lastHuntTime = character.lastHuntTime;
      let huntStreak = character.huntStreak || 0;
      let highestHuntStreak = character.highestHuntStreak || 0;

      // Reset streak if more than 24 hours since last hunt
      if (lastHuntTime && (now.getTime() - lastHuntTime.getTime()) > 24 * 60 * 60 * 1000) {
        huntStreak = 0;
        await this.prisma.character.update({
          where: { id: character.id },
          data: { huntStreak: 0 }
        });
      }

      if (source instanceof ChatInputCommandInteraction) {
        await source.deferReply();
      }

      // Process battle directly with character's level
      const battleResult = await this.battleService.processBattle(character.id, character.level);

      // Create battle log embed
      const embed = new EmbedBuilder()
        .setTitle('⚔️ Hunt Result')
        .setColor(battleResult.won ? '#00ff00' : '#ff0000')
        .setDescription(battleResult.battleLog.join('\n'));

      if (battleResult.won) {
        embed.addFields(
          { name: '✨ Experience', value: `+${battleResult.exp} EXP`, inline: true },
          { name: '💰 Coins', value: `+${battleResult.coins} coins`, inline: true },
          { name: '🔥 Hunt Streak', value: `${huntStreak + 1}`, inline: true }
        );
      } else {
        embed.addFields(
          { name: '❌ Defeat', value: 'You were defeated!', inline: true },
          { name: '🔥 Hunt Streak', value: 'Reset to 0', inline: true }
        );
      }

      // Update last hunt time
      await this.prisma.character.update({
        where: { id: character.id },
        data: { lastHuntTime: now }
      });

      return this.sendEmbedResponse(source, embed);
    } catch (error) {
      return this.handleCommandError(error, source, 'handleHunt');
    }
  }

  async handleHelp(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    try {
      const helpEmbed = new EmbedBuilder()
        .setTitle('📖 Panduan Command A4A CLAN BOT')
        .setColor('#FFD700')
        .addFields(
          {
            name: '👤 Character Commands',
            value: `
              \`a profile\` atau \`a p\` - 📊 Lihat status karaktermu
              \`a daily\` atau \`a d\` - 🎁 Klaim hadiah harian
              \`a balance\` atau \`a b\` - 💰 Cek uangmu
              \`a leaderboard\` atau \`a lb\` - 🏆 Lihat ranking pemain
              \`a give [user] [jumlah]\` - 💸 Berikan uang ke pemain lain
            `
          },
          {
            name: '⚔️ Battle Commands',
            value: `
              \`a hunt\` atau \`a h\` - ⚔️ Berburu monster
              \`a duel [user]\` - ⚔️ Tantang pemain lain untuk duel
              \`a accept\` - ✅ Terima tantangan duel
              \`a reject\` - ❌ Tolak tantangan duel
            `
          },
          {
            name: '🎒 Inventory & Equipment',
            value: `
              \`a inventory\` atau \`a i\` - 🎒 Lihat inventorymu
              \`a use [item]\` - 📦 Gunakan item dari inventory
              \`a equip [item]\` - 🔧 Pakai equipment
              \`a unequip [item]\` - 🔧 Lepas equipment
              \`a sell [item] [jumlah]\` - 💰 Jual item dari inventory
            `
          },
          {
            name: '🗺️ Location & Shop',
            value: `
              \`a map\` atau \`a m\` - 🗺️ Lihat peta
              \`a shop\` atau \`a s\` - 🛍️ Buka toko
              \`a buy [item]\` - 💰 Beli item dari toko
            `
          },
          {
            name: '📚 Training & Quiz',
            value: `
              \`a train\` atau \`a t\` - 📚 Berlatih dengan mentor
              \`a quiz\` atau \`a q\` - 📝 Ikuti quiz One Piece untuk hadiah
            `
          }
        )
        .setFooter({ text: 'Gunakan prefix "a " sebelum setiap command' });

      if (source instanceof Message) {
        return source.reply({ embeds: [helpEmbed] });
      } else {
        return source.reply({ embeds: [helpEmbed], ephemeral: true });
      }
    } catch (error) {
      const errorMessage = 'Terjadi kesalahan saat menampilkan bantuan.';
      if (source instanceof Message) {
        return source.reply(errorMessage);
      } else {
        return source.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }

  async handleUseItem(source: Message | ChatInputCommandInteraction, itemName: string): Promise<unknown> {
    try {
      const userId = this.getUserId(source);
      const character = await this.validateCharacter(userId, source);
      if (!character) return;

      // Convert common aliases to full item names
      const itemAliases: Record<string, string> = {
        'hp': 'health_potion',
        'p': 'health_potion',
        'pot': 'health_potion',
        'potion': 'health_potion',
        'mp': 'mana_potion',
        'sp': 'stamina_potion',
        'herb': 'medical_herb',
        'h': 'medical_herb',
        'meat': 'meat',
        'm': 'meat',
        'sm': 'super_meat',
        'rb': 'rumble_ball'
      };

      const normalizedItemName = itemName.toLowerCase().replace(/\s+/g, '_');
      const resolvedItemName = itemAliases[normalizedItemName] || normalizedItemName;

      // Get item from inventory
      const inventoryItem = await this.prisma.inventory.findFirst({
        where: {
          characterId: character.id,
          item: {
            id: resolvedItemName
          }
        },
        include: {
          item: true
        }
      });

      if (!inventoryItem) {
        return source.reply(`❌ Kamu tidak memiliki item "${itemName}"!`);
      }

      // Handle consumable items
      if (inventoryItem.item.type === 'CONSUMABLE') {
        const effect = JSON.parse(inventoryItem.item.effect);
        let healAmount = 0;
        let buffStats = null;
        let buffDuration = 0;

        // Calculate healing amount
        if (effect.heal) {
          if (typeof effect.heal === 'number') {
            healAmount = effect.heal;
          } else if (effect.heal.type === 'percentage') {
            healAmount = Math.floor((character.maxHealth * effect.heal.value) / 100);
          }
        }

        // Apply buff stats if any
        if (effect.buff) {
          buffStats = effect.buff.stats;
          buffDuration = effect.buff.duration;
        }

        // Apply healing
        if (healAmount > 0) {
          const oldHealth = character.health;
          const newHealth = await this.heal(character.id, healAmount);
          const actualHeal = newHealth - oldHealth;

          // Apply buff if exists
          if (buffStats) {
            type ValidBuffType = 'HEAL' | 'HEAL_OVER_TIME' | 'SUPER_MEAT' | 'RUMBLE_BALL' | 'ATTACK' | 'DEFENSE' | 'SPEED' | 'ALL';
            
            // Map item IDs to valid buff types
            const buffTypeMap: Record<string, ValidBuffType> = {
              'health_potion': 'HEAL',
              'medical_herb': 'HEAL_OVER_TIME',
              'meat': 'HEAL',
              'super_meat': 'SUPER_MEAT',
              'rumble_ball': 'RUMBLE_BALL',
              'attack_potion': 'ATTACK',
              'defense_potion': 'DEFENSE',
              'speed_potion': 'SPEED',
              'all_potion': 'ALL'
            };

            const buffType = buffTypeMap[inventoryItem.item.id] ?? 'HEAL';
            
            const buff: ActiveBuff = {
              type: buffType,
              value: Math.max(...Object.values(buffStats).filter(v => v !== undefined) as number[]),
              duration: buffDuration * 60, // Convert minutes to seconds
              expiresAt: Date.now() + (buffDuration * 60 * 1000), // Convert minutes to milliseconds
              source: inventoryItem.item.id
            };
            await this.addBuff(character.id, buff);
          }

          // Remove one item from inventory
          const remainingQuantity = inventoryItem.quantity - 1;
          if (remainingQuantity > 0) {
            await this.prisma.inventory.update({
              where: { id: inventoryItem.id },
              data: {
                quantity: remainingQuantity
              }
            });
          } else {
            await this.prisma.inventory.delete({
              where: { id: inventoryItem.id }
            });
          }

          const embed = new EmbedBuilder()
            .setTitle('🧪 Item Used')
            .setColor('#00ff00')
            .addFields([
              { 
                name: '💊 Item', 
                value: `${inventoryItem.item.name}\nRemaining: ${remainingQuantity}x`, 
                inline: true 
              },
              { 
                name: '❤️ Health', 
                value: `${oldHealth} → ${newHealth} (+${actualHeal})`, 
                inline: true 
              }
            ]);

          if (buffStats) {
            const buffDetails = Object.entries(buffStats)
              .map(([stat, value]) => `${stat.charAt(0).toUpperCase() + stat.slice(1)}: +${value}`)
              .join('\n');
            
            embed.addFields({
              name: '⚡ Buff Applied',
              value: `${buffDetails}\nDuration: ${buffDuration} minutes`,
              inline: true
            });
          }

          // Add warning if running low on items
          if (remainingQuantity <= 3 && remainingQuantity > 0) {
            embed.addFields({
              name: '⚠️ Warning',
              value: `You only have ${remainingQuantity} ${inventoryItem.item.name}${remainingQuantity === 1 ? '' : 's'} left!`,
              inline: false
            });
          } else if (remainingQuantity === 0) {
            embed.addFields({
              name: '⚠️ Warning',
              value: `This was your last ${inventoryItem.item.name}!`,
              inline: false
            });
          }

          return source.reply({ embeds: [embed] });
        }
      }

      return source.reply('❌ Item ini tidak bisa digunakan!');
    } catch (error) {
      return this.handleCommandError(error, source, 'handleUseItem');
    }
  }

  private getMentorEmoji(mentor: string): string {
    const emojiMap: Record<string, string> = {
      'YB': '⚔️',
      'Tierison': '🗡️',
      'LYuka': '🎯',
      'GarryAng': '🔥'
    };
    return emojiMap[mentor] || '👨‍🏫';
  }

  async handleInventory(message: Message) {
    const character = await this.getCharacterByDiscordId(message.author.id);
    if (!character) {
      return message.reply('❌ Kamu belum memiliki karakter! Gunakan `start` untuk membuat karakter.');
    }

    const inventory = await this.prisma.inventory.findMany({
      where: { characterId: character.id },
      include: { item: true }
    });

    if (!inventory || inventory.length === 0) {
      return message.reply('📦 Inventorymu masih kosong!');
    }

    // Group items by type
    const groupedItems = inventory.reduce((acc: Record<string, Array<{name: string; description: string; quantity: number; type: string}>>, inv) => {
      if (!acc[inv.item.type]) {
        acc[inv.item.type] = [];
      }
      acc[inv.item.type].push({
        name: inv.item.name,
        description: inv.item.description,
        quantity: inv.quantity,
        type: inv.item.type
      });
      return acc;
    }, {});

    const embed = new EmbedBuilder()
      .setTitle(`📦 Inventory ${character.name}`)
      .setColor('#0099ff');

    // Add fields for each item type
    for (const [type, items] of Object.entries(groupedItems)) {
      const itemList = items.map(item => 
        `${item.name} (x${item.quantity})\n${item.description}`
      ).join('\n\n');

      embed.addFields([{
        name: `${this.getItemTypeEmoji(type)} ${type}`,
        value: itemList || 'Kosong'
      }]);
    }

    return message.reply({ embeds: [embed] });
  }

  private getItemTypeEmoji(type: string): string {
    const emojiMap: Record<string, string> = {
      'CONSUMABLE': '🧪',
      'WEAPON': '⚔️',
      'ARMOR': '🛡️',
      'MATERIAL': '📦',
      'FOOD': '🍖',
      'INGREDIENT': '🌿'
    };
    return emojiMap[type] || '📦';
  }

  async getLeaderboard(
    type: 'level' | 'wins' | 'coins' | 'winStreak' | 'highestStreak' | 'huntStreak' = 'level',
    page: number = 1,
    limit: number = 10,
    filter?: string
  ) {
    try {
      const skip = (page - 1) * limit;
      let orderBy: any[] = [];
      let where: any = {};

      // Add filter if provided
      if (filter) {
        where.name = {
          contains: filter,
          mode: 'insensitive'
        };
      }

      switch (type) {
        case 'level':
          orderBy = [
            { level: 'desc' },
            { experience: 'desc' }
          ];
          break;
        case 'wins':
          orderBy = [{ wins: 'desc' }];
          break;
        case 'coins':
          orderBy = [
            { coins: 'desc' },
            { bank: 'desc' }
          ];
          break;
        case 'winStreak':
          orderBy = [{ winStreak: 'desc' }];
          break;
        case 'highestStreak':
          orderBy = [{ highestStreak: 'desc' }];
          break;
        case 'huntStreak':
          orderBy = [
            { huntStreak: 'desc' },
            { highestHuntStreak: 'desc' }
          ];
          break;
      }

      // Get total count for pagination
      const total = await this.prisma.character.count({ where });

      // Get paginated data
      const characters = await this.prisma.character.findMany({
        skip,
        take: limit,
        where,
        orderBy,
        include: {
          user: true
        }
      });

      const totalPages = Math.ceil(total / limit);

      return {
        data: characters.map((char, index) => ({
          rank: skip + index + 1,
          name: char.name,
          discordId: char.user.discordId,
          value: type === 'coins' ? char.coins + char.bank :
                 type === 'level' ? `Level ${char.level} (${char.experience} EXP)` :
                 type === 'huntStreak' ? `${char.huntStreak} (Highest: ${char.highestHuntStreak})` :
                 char[type]
        })),
        pagination: {
          page,
          totalPages,
          total,
          hasMore: page < totalPages
        }
      };
    } catch (error) {
      return this.handleError(error, 'GetLeaderboard');
    }
  }

  async handleLeaderboard(
    source: Message | ChatInputCommandInteraction, 
    type?: string,
    page: number = 1,
    filter?: string
  ): Promise<unknown> {
    try {
      const validTypes = ['level', 'wins', 'coins', 'winStreak', 'highestStreak', 'huntStreak'];
      const leaderboardType = type && validTypes.includes(type) ? type : 'level';
      const itemsPerPage = 10;

      const { data, pagination } = await this.getLeaderboard(
        leaderboardType as any,
        page,
        itemsPerPage,
        filter
      );
      
      const typeEmoji = {
        level: '📊',
        wins: '⚔️',
        coins: '💰',
        winStreak: '🔥',
        highestStreak: '👑',
        huntStreak: '🎯'
      }[leaderboardType];

      const typeTitle = {
        level: 'Level Tertinggi',
        wins: 'Total Kemenangan',
        coins: 'Total Kekayaan',
        winStreak: 'Win Streak Saat Ini',
        highestStreak: 'Win Streak Tertinggi',
        huntStreak: 'Hunt Streak'
      }[leaderboardType];

      const embed = new EmbedBuilder()
        .setTitle(`${typeEmoji} Leaderboard: ${typeTitle}`)
        .setColor('#ffd700');

      if (data.length === 0) {
        embed.setDescription('Tidak ada data untuk ditampilkan.');
      } else {
        embed.setDescription(
          data.map(entry => 
            `${entry.rank === 1 ? '👑' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `${entry.rank}.`} ${entry.name}: ${entry.value}`
          ).join('\n')
        );

        embed.setFooter({ 
          text: `Page ${pagination.page}/${pagination.totalPages} • Total ${pagination.total} players${filter ? ` • Filter: ${filter}` : ''}\nGunakan /lb [type] [page] [filter] atau menu dibawah untuk navigasi` 
        });
      }

      const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

      // Add type selection menu
      const typeSelect = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('leaderboard_type')
            .setPlaceholder('Pilih jenis leaderboard')
            .addOptions([
              {
                label: 'Level Tertinggi',
                description: 'Tampilkan ranking berdasarkan level',
                value: 'level',
                emoji: '📊',
                default: leaderboardType === 'level'
              },
              {
                label: 'Total Kemenangan',
                description: 'Tampilkan ranking berdasarkan jumlah kemenangan',
                value: 'wins',
                emoji: '⚔️',
                default: leaderboardType === 'wins'
              },
              {
                label: 'Total Kekayaan',
                description: 'Tampilkan ranking berdasarkan total coins',
                value: 'coins',
                emoji: '💰',
                default: leaderboardType === 'coins'
              },
              {
                label: 'Win Streak Saat Ini',
                description: 'Tampilkan ranking berdasarkan win streak saat ini',
                value: 'winStreak',
                emoji: '🔥',
                default: leaderboardType === 'winStreak'
              },
              {
                label: 'Win Streak Tertinggi',
                description: 'Tampilkan ranking berdasarkan win streak tertinggi',
                value: 'highestStreak',
                emoji: '👑',
                default: leaderboardType === 'highestStreak'
              },
              {
                label: 'Hunt Streak',
                description: 'Tampilkan ranking berdasarkan hunt streak',
                value: 'huntStreak',
                emoji: '🎯',
                default: leaderboardType === 'huntStreak'
              }
            ])
        );

      components.push(typeSelect);

      // Add navigation buttons if needed
      if (pagination.totalPages > 1) {
        const navigationRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`lb_first_${leaderboardType}`)
              .setLabel('⏪ First')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === 1),
            new ButtonBuilder()
              .setCustomId(`lb_prev_${leaderboardType}`)
              .setLabel('◀️ Prev')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(page === 1),
            new ButtonBuilder()
              .setCustomId(`lb_next_${leaderboardType}`)
              .setLabel('Next ▶️')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(page === pagination.totalPages),
            new ButtonBuilder()
              .setCustomId(`lb_last_${leaderboardType}`)
              .setLabel('Last ⏩')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === pagination.totalPages)
          );
        components.push(navigationRow);
      }

      // Add filter selection menu
      const filterSelect = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('leaderboard_filter')
            .setPlaceholder('Filter berdasarkan level')
            .addOptions([
              {
                label: 'Semua Level',
                description: 'Tampilkan semua pemain',
                value: 'all',
                emoji: '👥',
                default: !filter
              },
              {
                label: 'Level 1-10',
                description: 'Filter pemain level 1-10',
                value: 'low_level',
                emoji: '🔰',
                default: filter === 'low_level'
              },
              {
                label: 'Level 11-20',
                description: 'Filter pemain level 11-20',
                value: 'mid_level',
                emoji: '⚜️',
                default: filter === 'mid_level'
              },
              {
                label: 'Level 21+',
                description: 'Filter pemain level 21+',
                value: 'high_level',
                emoji: '👑',
                default: filter === 'high_level'
              }
            ])
        );

      components.push(filterSelect);

      const baseMessageOptions = {
        embeds: [embed],
        components,
        fetchReply: true as const
      };

      const messageOptions = source instanceof ChatInputCommandInteraction 
        ? { ...baseMessageOptions, ephemeral: true }
        : baseMessageOptions;

      const message = await (source instanceof ChatInputCommandInteraction 
        ? source.reply(messageOptions) 
        : source.reply(messageOptions)) as Message;

      // Create collectors for both buttons and select menus
      if (message) {
        // Collector for select menus
        const selectCollector = message.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          time: 300000 // 5 minutes
        });

        // Collector for buttons
        const buttonCollector = message.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 300000 // 5 minutes
        });

        // Handle select menu interactions
        selectCollector.on('collect', async (interaction: StringSelectMenuInteraction) => {
          await interaction.deferUpdate();
          
          const newType = interaction.customId === 'leaderboard_type' ? interaction.values[0] : leaderboardType;
          const newFilter = interaction.customId === 'leaderboard_filter' ? 
            (interaction.values[0] === 'all' ? undefined : interaction.values[0]) : 
            filter;

          // Update leaderboard with new type/filter
          await this.handleLeaderboard(source, newType, 1, newFilter);
        });

        // Handle button interactions
        buttonCollector.on('collect', async (interaction) => {
          await interaction.deferUpdate();

          const [action, type] = interaction.customId.split('_');
          let newPage = page;

          switch (action) {
            case 'lb':
              const command = type.split('_')[0]; // first, prev, next, or last
              switch (command) {
                case 'first':
                  newPage = 1;
                  break;
                case 'prev':
                  newPage = Math.max(1, page - 1);
                  break;
                case 'next':
                  newPage = Math.min(pagination.totalPages, page + 1);
                  break;
                case 'last':
                  newPage = pagination.totalPages;
                  break;
              }
              break;
          }

          if (newPage !== page) {
            await this.handleLeaderboard(source, leaderboardType, newPage, filter);
          }
        });

        // Handle collector end
        const cleanup = () => {
          if (message && 'edit' in message) {
            message.edit({ components: [] }).catch(console.error);
          }
        };

        selectCollector.on('end', cleanup);
        buttonCollector.on('end', cleanup);
      }

      return;
    } catch (error) {
      console.error('Error in handleLeaderboard:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (source instanceof ChatInputCommandInteraction) {
        return source.reply({ 
          content: `❌ Error: ${errorMessage}`,
          ephemeral: true
        });
      } else {
        return source.reply(`❌ Error: ${errorMessage}`);
      }
    }
  }

  async handleGiveCoins(source: Message | ChatInputCommandInteraction, targetId: string, amount: number): Promise<unknown> {
    try {
      // Get sender's character
      const sender = await this.getCharacterByDiscordId(source instanceof Message ? source.author.id : source.user.id);
      if (!sender) {
        return source.reply('❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.');
      }

      // Validate amount
      if (amount <= 0) {
        return source.reply('❌ Jumlah coins harus lebih dari 0!');
      }

      // Get sender's balance
      const senderBalance = await this.getBalance(sender.id);
      if (senderBalance.coins < amount) {
        return source.reply(`❌ Uang tidak cukup! Kamu butuh ${amount} coins.`);
      }

      // Get receiver's character
      const receiver = await this.getCharacterByDiscordId(targetId);
      if (!receiver) {
        return source.reply('❌ Player yang dituju belum memiliki karakter!');
      }

      // Don't allow sending to self
      if (sender.id === receiver.id) {
        return source.reply('❌ Kamu tidak bisa mengirim coins ke dirimu sendiri!');
      }

      // Process transfer
      await this.transferCoins(sender.id, receiver.id, amount);

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle('💰 Transfer Berhasil!')
        .setColor('#00ff00')
        .setDescription(`Berhasil mengirim ${amount} coins ke ${receiver.name}!`)
        .addFields([
          { name: '👤 Pengirim', value: sender.name, inline: true },
          { name: '👥 Penerima', value: receiver.name, inline: true },
          { name: '💰 Jumlah', value: `${amount} coins`, inline: true }
        ]);

      return source.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in handleGiveCoins:', error);
      return source.reply('❌ Terjadi kesalahan saat mengirim coins.');
    }
  }

  async handleSell(source: Message | ChatInputCommandInteraction, args?: string[]): Promise<unknown> {
    try {
      if (!this.inventoryService) {
        throw new Error('Inventory service not initialized');
      }

      const userId = source instanceof Message ? source.author.id : source.user.id;
      const character = await this.getCharacterByDiscordId(userId);
      
      if (!character) {
        return source.reply('❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.');
      }

      if (!args || args.length === 0) {
        return source.reply('❌ Format: `a sell [nama_item] [jumlah]`\nContoh: `a sell potion 5`');
      }

      // Parse quantity from last argument if it's a number
      let quantity = 1;
      let itemName = '';
      
      const lastArg = args[args.length - 1];
      if (!isNaN(parseInt(lastArg))) {
        quantity = Math.max(1, parseInt(lastArg)); // Ensure minimum 1
        itemName = args.slice(0, -1).join(' ').toLowerCase();
      } else {
        itemName = args.join(' ').toLowerCase();
      }

      // Find item in inventory
      const inventory = await this.prisma.inventory.findMany({
        where: { characterId: character.id },
        include: { item: true }
      });

      const inventoryItem = inventory.find(inv => {
        const itemNameLower = inv.item.name.toLowerCase();
        const searchNameLower = itemName.toLowerCase();
        
        // Clean both names by removing emojis and extra spaces
        const cleanItemName = itemNameLower.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        const cleanSearchName = searchNameLower.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        
        // Try exact match first
        if (cleanItemName === cleanSearchName) {
          return true;
        }

        // Try partial match with common aliases
        const aliases = {
          'full': ['full health potion', 'full hp', 'full heal'],
          'health': ['health potion', 'hp pot', 'heal pot'],
          'super': ['super health potion', 'super hp', 'super heal'],
          'meat': ['meat', 'food'],
          'super meat': ['super meat', 'super food']
        };

        // Check if search term matches any alias
        for (const [key, aliasList] of Object.entries(aliases)) {
          if (cleanItemName.includes(key) && aliasList.some(alias => cleanSearchName.includes(alias.toLowerCase()))) {
            return true;
          }
        }
        
        // Fallback to partial match
        return cleanItemName.includes(cleanSearchName) || cleanSearchName.includes(cleanItemName);
      });

      if (!inventoryItem) {
        return source.reply(`❌ Item "${itemName}" tidak ditemukan di inventory!`);
      }

      // Use inventory service to handle the sale
      return await this.inventoryService.handleSellItem(source, inventoryItem.itemId, quantity);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat menjual item';
      return source.reply(`❌ ${message}`);
    }
  }
}
