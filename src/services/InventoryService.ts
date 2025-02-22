import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { BaseService } from './BaseService';

interface ItemEffect {
  type: 'HEAL' | 'BUFF';
  value: number;
  stats?: {
    attack?: number;
    defense?: number;
    speed?: number;
  };
  duration?: number;
}

interface Item {
  id: string;
  name: string;
  description: string;
  type: string;
  value: number;
  effect: string;
}

export class InventoryService extends BaseService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async addItem(characterId: string, itemId: string, quantity: number = 1) {
    try {
      const item = await this.prisma.item.findUnique({
        where: { id: itemId }
      });
      
      if (!item) throw new Error('Item tidak ditemukan');

      await this.prisma.inventory.upsert({
        where: {
          characterId_itemId: {
            characterId,
            itemId
          }
        },
        update: {
          quantity: { increment: quantity }
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

  async useItem(characterId: string, itemId: string) {
    try {
      const item = await this.prisma.item.findUnique({
        where: { id: itemId }
      });

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

      let effect: ItemEffect | null = null;
      try {
        effect = JSON.parse(item.effect) as ItemEffect;
      } catch (e) {
        logger.warn(`Invalid effect JSON for item ${itemId}:`, e);
      }

      const result = await this.prisma.$transaction(async (tx) => {
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

        if (effect) {
          if (effect.type === 'HEAL') {
            await tx.character.update({
              where: { id: characterId },
              data: {
                health: {
                  increment: effect.value
                }
              }
            });
          } else if (effect.type === 'BUFF') {
            const character = await tx.character.findUnique({
              where: { id: characterId }
            });

            if (character) {
              const activeBuffs = JSON.parse(character.activeBuffs || '{"buffs":[]}');
              activeBuffs.buffs.push({
                ...effect.stats,
                expiresAt: Date.now() + (effect.duration || 3600) * 1000
              });

              await tx.character.update({
                where: { id: characterId },
                data: {
                  activeBuffs: JSON.stringify(activeBuffs)
                }
              });
            }
          }
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
        where: { characterId },
        include: {
          item: true
        }
      });

      return inventory.map(inv => ({
        ...inv.item,
        quantity: inv.quantity,
        effect: JSON.parse(inv.item.effect)
      }));
    } catch (error) {
      logger.error('Error getting inventory:', error);
      throw error;
    }
  }
}