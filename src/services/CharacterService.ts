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
import { Message, EmbedBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { checkCooldown, setCooldown, getRemainingCooldown } from '@/utils/cooldown';
import { createEphemeralReply } from '@/utils/helpers';

export type InteractionHandler = (source: Message | ChatInputCommandInteraction) => Promise<unknown>;

export interface ICharacterService {
  handleProfile: InteractionHandler;
  handleBalance: InteractionHandler;
  handleHunt: InteractionHandler;
  handleDaily: InteractionHandler;
  handleHelp: InteractionHandler;
  // ... other methods ...
}

export class CharacterService extends BaseService implements ICharacterService {
  private battleService: any; // Will be injected

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  setBattleService(battleService: any) {
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
      const initialActiveBuffs: ActiveBuffs = { buffs: [] };

      // Hitung base stats berdasarkan mentor
      let attack = CONFIG.STARTER_STATS.ATTACK;
      let defense = CONFIG.STARTER_STATS.DEFENSE;
      let health = CONFIG.STARTER_STATS.HEALTH;
      
      switch(mentor) {
        case 'YB': // Luffy
          attack = Math.floor(attack * 1.15); // +15% Attack
          defense = Math.floor(defense * 0.9); // -10% Defense
          health = Math.floor(health * 1.1); // +10% Health
          break;
        case 'Tierison': // Zoro
          attack = Math.floor(attack * 1.1); // +10% Attack
          defense = Math.floor(defense * 1.1); // +10% Defense
          break;
        case 'LYuka': // Usopp
          attack = Math.floor(attack * 0.9); // -10% Attack
          defense = Math.floor(defense * 1.2); // +20% Defense
          health = Math.floor(health * 1.05); // +5% Health
          break;
        case 'GarryAng': // Sanji
          attack = Math.floor(attack * 1.05); // +5% Attack
          defense = Math.floor(defense * 1.15); // +15% Defense
          health = Math.floor(health * 1.1); // +10% Health
          break;
      }

      // Create character in transaction with starter items
      const result = await this.prisma.$transaction(async (tx) => {
        // Create user and character
        const user = await tx.user.create({
          data: {
            discordId,
            character: {
              create: {
                name,
                mentor,
                level: 1,
                experience: 0,
                health,
                maxHealth: health,
                attack,
                defense,
                currentIsland: 'foosha' as LocationId,
                statusEffects: JSON.stringify(initialStatusEffects),
                activeBuffs: JSON.stringify(initialActiveBuffs),
                combo: 0,
                questPoints: 0,
                explorationPoints: 0,
                luffyProgress: 0,
                zoroProgress: 0,
                usoppProgress: 0,
                sanjiProgress: 0,
                dailyHealCount: 0
              },
            },
          },
          include: { character: true },
        });

        // Add starter items to inventory
        const starterItems = [
          { itemId: 'potion', quantity: 5 },
          { itemId: 'attack_buff', quantity: 3 },
          { itemId: 'defense_buff', quantity: 3 },
          { itemId: 'combat_ration', quantity: 3 },
          { itemId: 'starter_sword', quantity: 1 },
          { itemId: 'starter_armor', quantity: 1 }
        ];

        for (const item of starterItems) {
          await tx.inventory.create({
            data: {
              itemId: item.itemId,
              quantity: item.quantity,
              characterId: user.character!.id
            }
          });
        }

        return user.character!;
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
        statusEffects = JSON.parse(character.statusEffects) as StatusEffects;
        if (!statusEffects || !Array.isArray(statusEffects.effects)) {
          statusEffects = { effects: [] };
        }
      } catch (error) {
        statusEffects = { effects: [] };
      }

      // Parse and validate active buffs
      let activeBuffs: ActiveBuffs;
      try {
        activeBuffs = JSON.parse(character.activeBuffs) as ActiveBuffs;
        if (!activeBuffs || !Array.isArray(activeBuffs.buffs)) {
          activeBuffs = { buffs: [] };
        }
      } catch (error) {
        activeBuffs = { buffs: [] };
      }

      return {
        level: character.level,
        experience: character.experience,
        health: character.health,
        maxHealth: character.maxHealth,
        attack: character.attack,
        defense: character.defense,
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
        highestStreak: character.highestStreak
      };
    } catch (error) {
      return this.handleError(error, 'GetCharacterStats');
    }
  }

  private calculateMaxHealth(level: number): number {
    return CONFIG.STARTER_STATS.HEALTH + ((level - 1) * 10);
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
    return level * 1000;
  }

  async addExperience(characterId: string, amount: number): Promise<{
    leveledUp: boolean;
    newLevel?: number;
    newExp: number;
  }> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');

      const newExp = character.experience + amount;
      const currentLevel = character.level;
      const expNeeded = this.calculateExpNeeded(currentLevel);

      if (newExp >= expNeeded) {
        // Level up!
        const newLevel = currentLevel + 1;
        await this.prisma.character.update({
          where: { id: characterId },
          data: {
            level: newLevel,
            experience: newExp,
            health: this.calculateMaxHealth(newLevel),
            attack: { increment: 2 },
            defense: { increment: 2 }
          }
        });

        return {
          leveledUp: true,
          newLevel,
          newExp
        };
      } else {
        await this.prisma.character.update({
          where: { id: characterId },
          data: {
            experience: newExp
          }
        });

        return {
          leveledUp: false,
          newExp
        };
      }
    } catch (error) {
      return this.handleError(error, 'AddExperience');
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
      
      for (const buff of parsed.buffs) {
        if (!['ATTACK', 'DEFENSE', 'SPEED', 'ALL'].includes(buff.type)) {
          throw new Error(`Tipe buff tidak valid: ${buff.type}`);
        }
        if (typeof buff.value !== 'number' || buff.value < 0) {
          throw new Error('Value buff harus berupa angka positif');
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
      await prisma.transaction.createMany({
        data: [
          {
            characterId: senderId,
            type: 'TRANSFER',
            amount: -amount,
            description: `Transfer to ${receiverId}`
          },
          {
            characterId: receiverId,
            type: 'TRANSFER',
            amount: amount,
            description: `Transfer from ${senderId}`
          }
        ]
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

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${character.name}'s Profile`)
      .setColor('#0099ff')
      .addFields(
        { 
          name: '📈 Level & Experience', 
          value: `Level: ${stats.level}\nEXP: ${stats.experience}/${stats.level * 1000}`,
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
        },
        { 
          name: '⚔️ Battle Stats', 
          value: `ATK: ${stats.attack}\nDEF: ${stats.defense}\nWins: ${stats.wins}\nLosses: ${stats.losses}\nStreak: ${stats.winStreak}`,
          inline: true 
        }
      );

    if (stats.mentor) {
      embed.addFields({
        name: '👨‍🏫 Mentor',
        value: `${this.getMentorEmoji(stats.mentor)} ${stats.mentor}`,
        inline: true
      });
    }

    return embed;
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

  async handleProfile(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    try {
      const userId = source instanceof Message ? source.author.id : source.user.id;
      const embed = await this.createProfileEmbed(userId);
      return source.reply({ 
        embeds: [embed], 
        ephemeral: source instanceof ChatInputCommandInteraction 
      });
    } catch (error) {
      this.logger.error('Error in handleProfile:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return source instanceof Message 
        ? source.reply(`❌ Error: ${errorMessage}`)
        : source.reply(createEphemeralReply({ content: `❌ Error: ${errorMessage}` }));
    }
  }

  async handleBalance(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    try {
      const userId = source instanceof Message ? source.author.id : source.user.id;
      const embed = await this.createBalanceEmbed(userId);
      return source.reply({ 
        embeds: [embed], 
        ephemeral: source instanceof ChatInputCommandInteraction 
      });
    } catch (error) {
      this.logger.error('Error in handleBalance:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return source instanceof Message 
        ? source.reply(`❌ Error: ${errorMessage}`)
        : source.reply(createEphemeralReply({ content: `❌ Error: ${errorMessage}` }));
    }
  }

  async handleHunt(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    try {
      const userId = source instanceof Message ? source.author.id : source.user.id;
      
      // Check cooldown
      if (!checkCooldown(userId, 'hunt')) {
        const remainingTime = getRemainingCooldown(userId, 'hunt');
        const message = `⏰ Hunt sedang cooldown! Tunggu ${remainingTime} detik lagi.`;
        return source instanceof Message 
          ? source.reply(message)
          : source.reply(createEphemeralReply({ content: message }));
      }

      const character = await this.getCharacterByDiscordId(userId);
      if (!character) {
        const message = '❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.';
        return source instanceof Message 
          ? source.reply(message)
          : source.reply(createEphemeralReply({ content: message }));
      }

      // Get random monster based on character level
      const monster = this.getRandomMonster(character.level);
      
      // Defer reply for longer operation
      if (source instanceof ChatInputCommandInteraction) {
        await source.deferReply({ ephemeral: true });
      }

      // Process battle with animation
      const battleResult = await this.battleService.processBattle(character.id, monster.level[0]);

      // Calculate rewards
      const exp = monster.exp;
      const coins = Math.floor(Math.random() * (monster.coins[1] - monster.coins[0] + 1)) + monster.coins[0];

      // Update rewards if won
      if (battleResult.won) {
        await this.addExperience(character.id, exp);
        await this.addCoins(character.id, coins, 'HUNT', `Hunt reward from ${monster.name}`);
      }

      // Send battle log messages one by one with animation
      if (source instanceof ChatInputCommandInteraction) {
        for (let i = 0; i < battleResult.battleLog.length; i++) {
          const log = battleResult.battleLog[i];
          
          if (i === 0) {
            await source.editReply(log);
          } else {
            await source.followUp({
              ...log,
              ephemeral: true
            });
          }
          
          // Add delay between messages for animation effect
          // Skip delay for the last message
          if (i < battleResult.battleLog.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        }

        // Send final rewards message after a short delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const rewardsEmbed = new EmbedBuilder()
          .setTitle(`🎁 Rewards dari ${monster.name}`)
          .setColor(battleResult.won ? '#00ff00' : '#ff0000')
          .addFields(
            { name: '✨ Experience', value: battleResult.won ? `+${exp} EXP` : '0 EXP', inline: true },
            { name: '💰 Coins', value: battleResult.won ? `+${coins} coins` : '0 coins', inline: true }
          );

        await source.followUp({
          embeds: [rewardsEmbed],
          ephemeral: true
        });
      } else {
        // For message commands, send everything in one message
        const embed = new EmbedBuilder()
          .setTitle(`🗡️ Hunt Result: ${monster.name}`)
          .setColor(battleResult.won ? '#00ff00' : '#ff0000')
          .setDescription(battleResult.won ? 'You won!' : 'You lost!')
          .addFields(
            { name: '✨ Experience', value: battleResult.won ? `+${exp} EXP` : '0 EXP', inline: true },
            { name: '💰 Coins', value: battleResult.won ? `+${coins} coins` : '0 coins', inline: true }
          );

        return source.reply({ embeds: [embed] });
      }

      // Set cooldown
      setCooldown(userId, 'hunt');

      return;
    } catch (error) {
      this.logger.error('Error in handleHunt:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return source instanceof Message 
        ? source.reply(`❌ Error: ${errorMessage}`)
        : source.reply(createEphemeralReply({ content: `❌ Error: ${errorMessage}` }));
    }
  }

  async handleDaily(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    try {
      const userId = source instanceof Message ? source.author.id : source.user.id;
      
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

      const character = await this.getCharacterByDiscordId(userId);
      if (!character) {
        const message = '❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.';
        return source instanceof Message 
          ? source.reply(message)
          : source.reply(createEphemeralReply({ content: message }));
      }

      // Calculate rewards
      const exp = 100 + Math.floor(Math.random() * 50);
      const coins = 100 + Math.floor(Math.random() * 100);
      
      // Update character
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

      // Set cooldown
      setCooldown(userId, 'daily');

      return source.reply({ 
        embeds: [embed], 
        ephemeral: source instanceof ChatInputCommandInteraction 
      });
    } catch (error) {
      this.logger.error('Error in handleDaily:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return source instanceof Message 
        ? source.reply(`❌ Error: ${errorMessage}`)
        : source.reply(createEphemeralReply({ content: `❌ Error: ${errorMessage}` }));
    }
  }

  async handleHelp(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    try {
      const commandList = [
        { cmd: '/a h', desc: '🗡️ Berburu dengan battle log animasi (15s cd)' },
        { cmd: 'a h', desc: '🗡️ Berburu tanpa animasi (15s cd)' },
        { cmd: 'a p', desc: '📊 Lihat profil' },
        { cmd: 'a d', desc: '🎁 Daily reward' },
        { cmd: 'a i', desc: '🎒 Inventory' },
        { cmd: 'a u', desc: '📦 Gunakan item' },
        { cmd: 'a b', desc: '💰 Balance' },
        { cmd: 'a t', desc: '⚔️ Training' },
        { cmd: 'a m', desc: '🗺️ Map' },
        { cmd: 'a s', desc: '🛍️ Shop' }
      ];

      const embed = new EmbedBuilder()
        .setTitle('❓ A4A CLAN BOT - Panduan')
        .setColor('#00ff00')
        .setDescription('A4A CLAN BOT adalah game RPG One Piece yang dikembangkan oleh <@714556781912653855>')
        .addFields([
          { 
            name: '📜 Basic Commands', 
            value: commandList.map(c => `\`${c.cmd}\` - ${c.desc}`).join('\n')
          },
          {
            name: '💡 Perbedaan Hunt Command',
            value: '• `/a h` - Dengan battle log animasi\n• `a h` - Langsung hasil akhir'
          },
          {
            name: '🎮 Tips',
            value: 'Gunakan `/a h` untuk melihat battle log animasi saat berburu!\nMulai dengan berburu di Foosha Village untuk mendapatkan EXP dan item!'
          }
        ]);

      if (source instanceof ChatInputCommandInteraction) {
        return source.reply({ 
          embeds: [embed],
          flags: MessageFlags.Ephemeral
        });
      } else {
        return source.reply({ embeds: [embed] });
      }
    } catch (error) {
      this.logger.error('Error in handleHelp:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (source instanceof ChatInputCommandInteraction) {
        return source.reply({ 
          content: `❌ Error: ${errorMessage}`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        return source.reply(`❌ Error: ${errorMessage}`);
      }
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

  private getRandomMonster(characterLevel: number): {
    name: string;
    level: [number, number];
    exp: number;
    coins: [number, number];
  } {
    const ENCOUNTERS = {
      COMMON: {
        chance: 0.7,
        monsters: [
          { name: '🐗 Wild Boar', level: [1, 3] as [number, number], exp: 20, coins: [10, 30] as [number, number] },
          { name: '🐺 Wolf', level: [2, 4] as [number, number], exp: 25, coins: [15, 35] as [number, number] },
          { name: '🦊 Fox', level: [3, 5] as [number, number], exp: 30, coins: [20, 40] as [number, number] }
        ]
      },
      RARE: {
        chance: 0.2,
        monsters: [
          { name: '🐉 Baby Dragon', level: [4, 6] as [number, number], exp: 50, coins: [40, 60] as [number, number] },
          { name: '🦁 Lion', level: [5, 7] as [number, number], exp: 55, coins: [45, 65] as [number, number] },
          { name: '🐯 Tiger', level: [6, 8] as [number, number], exp: 60, coins: [50, 70] as [number, number] }
        ]
      },
      EPIC: {
        chance: 0.08,
        monsters: [
          { name: '🐲 Adult Dragon', level: [7, 9] as [number, number], exp: 100, coins: [80, 120] as [number, number] },
          { name: '🦅 Giant Eagle', level: [8, 10] as [number, number], exp: 110, coins: [90, 130] as [number, number] },
          { name: '🐘 War Elephant', level: [9, 11] as [number, number], exp: 120, coins: [100, 140] as [number, number] }
        ]
      },
      LEGENDARY: {
        chance: 0.02,
        monsters: [
          { name: '🔥 Phoenix', level: [10, 12] as [number, number], exp: 200, coins: [150, 250] as [number, number] },
          { name: '⚡ Thunder Bird', level: [11, 13] as [number, number], exp: 220, coins: [170, 270] as [number, number] },
          { name: '🌊 Leviathan', level: [12, 14] as [number, number], exp: 240, coins: [190, 290] as [number, number] }
        ]
      }
    };

    const rand = Math.random();
    let cumChance = 0;
    
    for (const [rarity, data] of Object.entries(ENCOUNTERS)) {
      cumChance += data.chance;
      if (rand <= cumChance) {
        const possibleMonsters = data.monsters.filter(m => 
          m.level[0] <= characterLevel + 3 && m.level[1] >= characterLevel - 1
        );
        if (possibleMonsters.length === 0) continue;
        return possibleMonsters[Math.floor(Math.random() * possibleMonsters.length)];
      }
    }
    
    return ENCOUNTERS.COMMON.monsters[0];
  }

  async getLeaderboard(type: 'level' | 'wins' | 'coins' | 'winStreak' | 'highestStreak' = 'level', limit: number = 10) {
    try {
      let orderBy: any[] = [];
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
      }

      const characters = await this.prisma.character.findMany({
        take: limit,
        orderBy,
        include: {
          user: true
        }
      });

      return characters.map((char, index) => ({
        rank: index + 1,
        name: char.name,
        discordId: char.user.discordId,
        value: type === 'coins' ? char.coins + char.bank :
               type === 'level' ? `Level ${char.level} (${char.experience} EXP)` :
               char[type]
      }));
    } catch (error) {
      return this.handleError(error, 'GetLeaderboard');
    }
  }

  async handleLeaderboard(source: Message | ChatInputCommandInteraction, type?: string): Promise<unknown> {
    try {
      const validTypes = ['level', 'wins', 'coins', 'winStreak', 'highestStreak'];
      const leaderboardType = type && validTypes.includes(type) ? type : 'level';

      const data = await this.getLeaderboard(leaderboardType as any);
      
      const typeEmoji = {
        level: '📊',
        wins: '⚔️',
        coins: '💰',
        winStreak: '🔥',
        highestStreak: '👑'
      }[leaderboardType];

      const typeTitle = {
        level: 'Level Tertinggi',
        wins: 'Total Kemenangan',
        coins: 'Total Kekayaan',
        winStreak: 'Win Streak Saat Ini',
        highestStreak: 'Win Streak Tertinggi'
      }[leaderboardType];

      const embed = new EmbedBuilder()
        .setTitle(`${typeEmoji} Leaderboard: ${typeTitle}`)
        .setColor('#ffd700')
        .setDescription(
          data.map(entry => 
            `${entry.rank === 1 ? '👑' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `${entry.rank}.`} ${entry.name}: ${entry.value}`
          ).join('\n')
        )
        .setFooter({ text: 'Gunakan /lb [level/wins/coins/winStreak/highestStreak] untuk melihat leaderboard lainnya' });

      if (source instanceof ChatInputCommandInteraction) {
        return source.reply({ 
          embeds: [embed],
          flags: MessageFlags.Ephemeral
        });
      } else {
        return source.reply({ embeds: [embed] });
      }
    } catch (error) {
      this.logger.error('Error in handleLeaderboard:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (source instanceof ChatInputCommandInteraction) {
        return source.reply({ 
          content: `❌ Error: ${errorMessage}`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        return source.reply(`❌ Error: ${errorMessage}`);
      }
    }
  }
}