import { PrismaClient } from '@prisma/client';
import { BaseService } from './BaseService';
import { Message, EmbedBuilder } from 'discord.js';

interface BuyResult {
  success: boolean;
  message: string;
}

export class ShopService extends BaseService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async buyItem(characterId: string, itemId: string): Promise<BuyResult> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) {
        throw new Error('Character not found');
      }

      // Get item price
      const prices = {
        'health_potion': 50,
        'basic_sword': 100,
        'basic_armor': 100
      };

      const price = prices[itemId as keyof typeof prices];
      if (!price) {
        throw new Error('Item not found');
      }

      // Check if character has enough coins
      if (character.coins < price) {
        return {
          success: false,
          message: '❌ Uang tidak cukup!'
        };
      }

      // Process purchase
      await this.prisma.$transaction([
        // Remove coins
        this.prisma.character.update({
          where: { id: characterId },
          data: { coins: { decrement: price } }
        }),
        // Add item to inventory
        this.prisma.inventory.upsert({
          where: {
            characterId_itemId: {
              characterId,
              itemId
            }
          },
          create: {
            characterId,
            itemId,
            quantity: 1
          },
          update: {
            quantity: { increment: 1 }
          }
        }),
        // Create transaction record
        this.prisma.transaction.create({
          data: {
            characterId,
            type: 'SHOP_PURCHASE',
            amount: -price,
            description: `Bought ${itemId}`
          }
        })
      ]);

      return {
        success: true,
        message: `✅ Berhasil membeli ${itemId} seharga ${price} coins!`
      };
    } catch (error) {
      return this.handleError(error, 'BuyItem');
    }
  }

  async handleShop(message: Message) {
    // Implementation will be added later
    return message.reply('🔄 Fitur shop dalam pengembangan...');
  }
} 