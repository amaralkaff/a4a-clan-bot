import { BaseService } from './BaseService';
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
import { Message, EmbedBuilder } from 'discord.js';
import { checkCooldown, setCooldown, getRemainingCooldown } from '@/utils/cooldown';

export class CharacterService extends BaseService {
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

  // Add message-based command handlers
  async handleProfile(message: Message) {
    const character = await this.getCharacterByDiscordId(message.author.id);
    if (!character) {
      return message.reply('❌ Kamu belum memiliki karakter! Gunakan `start` untuk membuat karakter.');
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

    // Add mentor info if exists
    if (stats.mentor) {
      embed.addFields({
        name: '👨‍🏫 Mentor',
        value: `${this.getMentorEmoji(stats.mentor)} ${stats.mentor}`,
        inline: true
      });
    }

    return message.reply({ embeds: [embed] });
  }

  async handleHelp(message: Message) {
    const embed = new EmbedBuilder()
      .setTitle('❓ A4A CLAN BOT - Panduan')
      .setColor('#00ff00')
      .setDescription('One Piece RPG Game')
      .addFields([
        { 
          name: '📜 Basic Commands', 
          value: 
`\`a p\` - 📊 Lihat profil
\`a h\` - 🗡️ Berburu (15s cd)
\`a d\` - 🎁 Daily reward
\`a i\` - 🎒 Inventory
\`a u\` - 📦 Gunakan item
\`a b\` - 💰 Balance
\`a t\` - ⚔️ Training
\`a m\` - 🗺️ Map
\`a s\` - 🛍️ Shop`
        },
        {
          name: '🎮 Tips',
          value: 'Mulai dengan berburu di Foosha Village untuk mendapatkan EXP dan item!'
        }
      ]);

    return message.reply({ embeds: [embed] });
  }

  async handleHunt(message: Message) {
    // Check cooldown
    if (!checkCooldown(message.author.id, 'hunt')) {
      const remainingTime = getRemainingCooldown(message.author.id, 'hunt');
      return message.reply(`⏰ Hunt sedang cooldown! Tunggu ${remainingTime} detik lagi.`);
    }

    const character = await this.getCharacterByDiscordId(message.author.id);
    if (!character) {
      return message.reply('❌ Kamu belum memiliki karakter! Gunakan `start` untuk membuat karakter.');
    }

    // Get random monster based on character level
    const monster = this.getRandomMonster(character.level);
    
    // Calculate rewards
    const exp = monster.exp;
    const coins = Math.floor(Math.random() * (monster.coins[1] - monster.coins[0] + 1)) + monster.coins[0];

    // Process battle
    const result = await this.battleService.processBattle(character.id, monster.level[0]);
    
    // Update rewards if won
    if (result.won) {
      await this.addExperience(character.id, exp);
      await this.addCoins(character.id, coins, 'HUNT', `Hunt reward from ${monster.name}`);
    }

    // Create result embed
    const embed = new EmbedBuilder()
      .setTitle(`🗡️ Hunt Result: ${monster.name}`)
      .setColor(result.won ? '#00ff00' : '#ff0000')
      .setDescription(result.won ? 'You won!' : 'You lost!')
      .addFields(
        { name: '✨ Experience', value: result.won ? `+${exp} EXP` : '0 EXP', inline: true },
        { name: '💰 Coins', value: result.won ? `+${coins} coins` : '0 coins', inline: true }
      );

    // Set cooldown
    setCooldown(message.author.id, 'hunt');

    return message.reply({ embeds: [embed] });
  }

  async handleDaily(message: Message) {
    // Check cooldown
    if (!checkCooldown(message.author.id, 'daily')) {
      const remainingTime = getRemainingCooldown(message.author.id, 'daily');
      const hours = Math.floor(remainingTime / 3600);
      const minutes = Math.floor((remainingTime % 3600) / 60);
      return message.reply(`⏰ Daily reward sedang cooldown!\nTunggu ${hours}h ${minutes}m lagi.`);
    }

    const character = await this.getCharacterByDiscordId(message.author.id);
    if (!character) {
      return message.reply('❌ Kamu belum memiliki karakter! Gunakan `start` untuk membuat karakter.');
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
    setCooldown(message.author.id, 'daily');

    return message.reply({ embeds: [embed] });
  }

  private getRandomMonster(characterLevel: number) {
    const ENCOUNTERS = {
      COMMON: {
        chance: 0.7,
        monsters: [
          { name: '🐗 Wild Boar', level: [1, 3], exp: 20, coins: [10, 30] },
          { name: '🐺 Wolf', level: [2, 4], exp: 25, coins: [15, 35] },
          { name: '🦊 Fox', level: [3, 5], exp: 30, coins: [20, 40] }
        ]
      },
      RARE: {
        chance: 0.2,
        monsters: [
          { name: '🐉 Baby Dragon', level: [4, 6], exp: 50, coins: [40, 60] },
          { name: '🦁 Lion', level: [5, 7], exp: 55, coins: [45, 65] },
          { name: '🐯 Tiger', level: [6, 8], exp: 60, coins: [50, 70] }
        ]
      },
      EPIC: {
        chance: 0.08,
        monsters: [
          { name: '🐲 Adult Dragon', level: [7, 9], exp: 100, coins: [80, 120] },
          { name: '🦅 Giant Eagle', level: [8, 10], exp: 110, coins: [90, 130] },
          { name: '🐘 War Elephant', level: [9, 11], exp: 120, coins: [100, 140] }
        ]
      },
      LEGENDARY: {
        chance: 0.02,
        monsters: [
          { name: '🔥 Phoenix', level: [10, 12], exp: 200, coins: [150, 250] },
          { name: '⚡ Thunder Bird', level: [11, 13], exp: 220, coins: [170, 270] },
          { name: '🌊 Leviathan', level: [12, 14], exp: 240, coins: [190, 290] }
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
    
    return ENCOUNTERS.COMMON.monsters[0]; // Fallback to first common monster
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

  async handleBalance(message: Message) {
    const character = await this.getCharacterByDiscordId(message.author.id);
    if (!character) {
      return message.reply('❌ Kamu belum memiliki karakter! Gunakan `start` untuk membuat karakter.');
    }

    const balance = await this.getBalance(character.id);
    const transactions = await this.getTransactionHistory(character.id, 5);

    const embed = new EmbedBuilder()
      .setTitle('💰 Dompetmu')
      .setColor('#ffd700')
      .addFields([
        { name: '💵 Uang Cash', value: `${balance.coins} coins`, inline: true },
        { name: '🏦 Bank', value: `${balance.bank} coins`, inline: true },
        { name: '💰 Total', value: `${balance.coins + balance.bank} coins`, inline: true }
      ]);

    // Add transaction history if exists
    if (transactions.length > 0) {
      const historyText = transactions.map(tx => {
        const amount = tx.amount > 0 ? `+${tx.amount}` : tx.amount;
        return `${tx.type}: ${amount} coins (${tx.description})`;
      }).join('\n');
      
      embed.addFields([
        { name: '📜 Riwayat Transaksi Terakhir', value: historyText }
      ]);
    }

    return message.reply({ embeds: [embed] });
  }
}