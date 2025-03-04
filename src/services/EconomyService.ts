import { PrismaClient } from '@prisma/client';
import { BaseService } from './BaseService';
import { Message, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { TransactionType } from '@/types/game';
import { CharacterService } from './CharacterService';
import { Cache } from '../utils/Cache';

const NO_CHARACTER_MSG = '❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.';

interface CachedBalance {
  coins: number;
  bank: number;
  lastUpdated: number;
}

interface CachedTransactions {
  transactions: any[];
  lastUpdated: number;
}

export class EconomyService extends BaseService {
  private characterService: CharacterService;
  private balanceCache: Cache<CachedBalance>;
  private transactionCache: Cache<CachedTransactions>;
  private readonly BALANCE_CACHE_TTL = 1 * 60 * 1000; // 1 minute
  private readonly TRANSACTION_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

  constructor(prisma: PrismaClient, characterService: CharacterService) {
    super(prisma);
    this.characterService = characterService;
    this.balanceCache = new Cache<CachedBalance>(this.BALANCE_CACHE_TTL);
    this.transactionCache = new Cache<CachedTransactions>(this.TRANSACTION_CACHE_TTL);

    // Set up periodic cache cleanup
    setInterval(() => {
      this.balanceCache.cleanup();
      this.transactionCache.cleanup();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  private getBalanceCacheKey(characterId: string): string {
    return `balance_${characterId}`;
  }

  private getTransactionCacheKey(characterId: string): string {
    return `transactions_${characterId}`;
  }

  async addCoins(characterId: string, amount: number, type: TransactionType, description: string) {
    try {
      await this.prisma.$transaction([
        this.prisma.character.update({
          where: { id: characterId },
          data: { coins: { increment: amount } }
        }),
        this.prisma.transaction.create({
          data: {
            characterId,
            amount,
            type,
            description
          }
        })
      ]);

      // Invalidate caches
      this.balanceCache.delete(this.getBalanceCacheKey(characterId));
      this.transactionCache.delete(this.getTransactionCacheKey(characterId));
    } catch (error) {
      return this.handleError(error, 'AddCoins');
    }
  }

  async removeCoins(characterId: string, amount: number, type: TransactionType, description: string) {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');
      if (Number(character.coins) < amount) throw new Error('Insufficient coins');

      await this.prisma.$transaction([
        this.prisma.character.update({
          where: { id: characterId },
          data: { coins: { decrement: amount } }
        }),
        this.prisma.transaction.create({
          data: {
            characterId,
            amount: -amount,
            type,
            description
          }
        })
      ]);

      // Invalidate caches
      this.balanceCache.delete(this.getBalanceCacheKey(characterId));
      this.transactionCache.delete(this.getTransactionCacheKey(characterId));
    } catch (error) {
      return this.handleError(error, 'RemoveCoins');
    }
  }

  async transferCoins(senderId: string, receiverId: string, amount: number) {
    try {
      const [sender, receiver] = await this.prisma.$transaction([
        this.prisma.character.findUnique({ where: { id: senderId } }),
        this.prisma.character.findUnique({ where: { id: receiverId } })
      ]);

      if (!sender || !receiver) {
        throw new Error('One or both characters not found');
      }

      if (Number(sender.coins) < amount) {
        throw new Error('Insufficient coins');
      }

      await this.prisma.$transaction([
        this.prisma.character.update({
          where: { id: senderId },
          data: { coins: { decrement: amount } }
        }),
        this.prisma.character.update({
          where: { id: receiverId },
          data: { coins: { increment: amount } }
        }),
        this.prisma.transaction.create({
          data: {
            characterId: senderId,
            amount: -amount,
            type: 'TRANSFER_SENT',
            description: `Transfer to ${receiver.name}`
          }
        }),
        this.prisma.transaction.create({
          data: {
            characterId: receiverId,
            amount: amount,
            type: 'TRANSFER_RECEIVED',
            description: `Transfer from ${sender.name}`
          }
        })
      ]);

      // Invalidate caches for both sender and receiver
      this.balanceCache.delete(this.getBalanceCacheKey(senderId));
      this.balanceCache.delete(this.getBalanceCacheKey(receiverId));
      this.transactionCache.delete(this.getTransactionCacheKey(senderId));
      this.transactionCache.delete(this.getTransactionCacheKey(receiverId));

      return {
        success: true,
        message: `Successfully transferred ${amount} coins from ${sender.name} to ${receiver.name}`
      };
    } catch (error) {
      return this.handleError(error, 'TransferCoins');
    }
  }

  async depositToBank(characterId: string, amount: number): Promise<void> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');
      if (Number(character.coins) < amount) throw new Error('Insufficient coins');

      await this.prisma.$transaction([
        this.prisma.character.update({
          where: { id: characterId },
          data: {
            coins: { decrement: amount },
            bank: { increment: amount }
          }
        }),
        this.prisma.transaction.create({
          data: {
            characterId,
            amount: -amount,
            type: 'BANK_DEPOSIT',
            description: 'Bank deposit'
          }
        })
      ]);

      // Invalidate caches
      this.balanceCache.delete(this.getBalanceCacheKey(characterId));
      this.transactionCache.delete(this.getTransactionCacheKey(characterId));
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
      if (Number(character.bank) < amount) throw new Error('Insufficient bank balance');

      await this.prisma.$transaction([
        this.prisma.character.update({
          where: { id: characterId },
          data: {
            coins: { increment: amount },
            bank: { decrement: amount }
          }
        }),
        this.prisma.transaction.create({
          data: {
            characterId,
            amount: amount,
            type: 'BANK_WITHDRAWAL',
            description: 'Bank withdrawal'
          }
        })
      ]);

      // Invalidate caches
      this.balanceCache.delete(this.getBalanceCacheKey(characterId));
      this.transactionCache.delete(this.getTransactionCacheKey(characterId));
    } catch (error) {
      return this.handleError(error, 'WithdrawFromBank');
    }
  }

  async getBalance(characterId: string): Promise<{ coins: number; bank: number }> {
    try {
      // Check cache first
      const cacheKey = this.getBalanceCacheKey(characterId);
      const cachedBalance = this.balanceCache.get(cacheKey);
      if (cachedBalance) {
        return {
          coins: cachedBalance.coins,
          bank: cachedBalance.bank
        };
      }

      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        select: { coins: true, bank: true }
      });

      if (!character) throw new Error('Character not found');

      const balance = {
        coins: Number(character.coins),
        bank: Number(character.bank)
      };

      // Cache the balance
      this.balanceCache.set(cacheKey, {
        ...balance,
        lastUpdated: Date.now()
      });

      return balance;
    } catch (error) {
      return this.handleError(error, 'GetBalance');
    }
  }

  async getTransactionHistory(characterId: string, limit: number = 10): Promise<any[]> {
    try {
      // Check cache first
      const cacheKey = this.getTransactionCacheKey(characterId);
      const cachedTransactions = this.transactionCache.get(cacheKey);
      if (cachedTransactions && cachedTransactions.transactions.length >= limit) {
        return cachedTransactions.transactions.slice(0, limit);
      }

      const transactions = await this.prisma.transaction.findMany({
        where: { characterId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      // Cache the transactions
      this.transactionCache.set(cacheKey, {
        transactions,
        lastUpdated: Date.now()
      });

      return transactions;
    } catch (error) {
      return this.handleError(error, 'GetTransactionHistory');
    }
  }

  async handleBalance(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    try {
      const userId = source instanceof Message ? source.author.id : source.user.id;
      const character = await this.characterService.getCharacterByDiscordId(userId);

      if (!character) {
        return source.reply(NO_CHARACTER_MSG);
      }

      const balance = await this.getBalance(character.id);
      const transactions = await this.getTransactionHistory(character.id, 5);

      const embed = new EmbedBuilder()
        .setTitle(`💰 ${character.name}'s Balance`)
        .setColor('#FFD700')
        .addFields([
          { name: '💵 Coins', value: `${balance.coins}`, inline: true },
          { name: '🏦 Bank', value: `${balance.bank}`, inline: true },
          { name: '💎 Total', value: `${balance.coins + balance.bank}`, inline: true }
        ]);

      if (transactions.length > 0) {
        const transactionList = transactions
          .map(t => `${t.type}: ${t.amount > 0 ? '+' : ''}${t.amount} - ${t.description}`)
          .join('\n');
        embed.addFields({ name: '📜 Recent Transactions', value: transactionList });
      }

      return source.reply({ embeds: [embed] });
    } catch (error) {
      return this.handleError(error, 'HandleBalance');
    }
  }
} 