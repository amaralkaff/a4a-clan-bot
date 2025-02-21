import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

interface Item {
  id: string;
  name: string;
  description: string;
  effect?: {
    type: 'HEAL' | 'BUFF';
    value: number;
  };
}

export class InventoryService {
  private prisma: PrismaClient;
  private items: Map<string, Item>;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.items = new Map([
      ['potion', {
        id: 'potion',
        name: 'Health Potion',
        description: 'Memulihkan 50 HP',
        effect: {
          type: 'HEAL',
          value: 50
        }
      }],
      ['attack_buff', {
        id: 'attack_buff',
        name: 'Attack Boost',
        description: 'Meningkatkan attack sebesar 5 selama pertarungan',
        effect: {
          type: 'BUFF',
          value: 5
        }
      }]
    ]);
  }

  async addItem(characterId: string, itemId: string, quantity: number = 1) {
    try {
      const item = this.items.get(itemId);
      if (!item) throw new Error('Item tidak ditemukan');

      // Menggunakan where clause yang benar
      await this.prisma.inventory.upsert({
        where: {
          id: await this.getInventoryId(characterId, itemId)
        },
        update: {
          quantity: {
            increment: quantity
          }
        },
        create: {
          characterId,
          itemId,
          quantity
        }
      });

      return true;
    } catch (error) {
      logger.error('Error adding item:', error);
      throw error;
    }
  }

  private async getInventoryId(characterId: string, itemId: string): Promise<string> {
    const inventory = await this.prisma.inventory.findFirst({
      where: {
        characterId,
        itemId
      }
    });
    return inventory?.id || 'new';
  }

  async useItem(characterId: string, itemId: string) {
    try {
      const item = this.items.get(itemId);
      if (!item) throw new Error('Item tidak ditemukan');

      const inventory = await this.prisma.inventory.findFirst({
        where: {
          characterId,
          itemId
        }
      });

      if (!inventory || inventory.quantity <= 0) {
        throw new Error('Item tidak tersedia di inventory');
      }

      // Begin transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Reduce item quantity
        await tx.inventory.update({
          where: {
            id: inventory.id
          },
          data: {
            quantity: {
              decrement: 1
            }
          }
        });

        // Apply item effect
        if (item.effect) {
          if (item.effect.type === 'HEAL') {
            await tx.character.update({
              where: { id: characterId },
              data: {
                health: {
                  increment: item.effect.value
                }
              }
            });
          }
          // Add more effect types here
        }

        return item;
      });

      return {
        success: true,
        item: result,
        message: `Berhasil menggunakan ${item.name}`
      };
    } catch (error) {
      logger.error('Error using item:', error);
      throw error;
    }
  }

  async getInventory(characterId: string) {
    try {
      const inventory = await this.prisma.inventory.findMany({
        where: { characterId }
      });

      return inventory.map(inv => ({
        ...this.items.get(inv.itemId),
        quantity: inv.quantity
      }));
    } catch (error) {
      logger.error('Error getting inventory:', error);
      throw error;
    }
  }
}