import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { BaseService } from './BaseService';
import { Message, EmbedBuilder, ChatInputCommandInteraction, ApplicationCommandOptionChoiceData } from 'discord.js';
import { sendResponse } from '@/utils/helpers';
import { getItemTypeEmoji } from '@/commands/basic/handlers/utils';
import { CharacterService } from './CharacterService';

const NO_CHARACTER_MSG = '❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.';

interface ItemEffect {
  type: 'HEAL' | 'BUFF' | 'HEAL_AND_BUFF';
  value?: number;
  health?: number;
  stats?: {
    attack?: number;
    defense?: number;
    speed?: number;
  };
  duration?: number;
}

export class InventoryService extends BaseService {
  private characterService: CharacterService;

  constructor(prisma: PrismaClient, characterService: CharacterService) {
    super(prisma);
    this.characterService = characterService;
  }

  private async getCharacterOrThrow(discordId: string) {
    const character = await this.characterService.getCharacterByDiscordId(discordId);
    if (!character) throw new Error(NO_CHARACTER_MSG);
    return character;
  }

  async useItem(characterId: string, itemId: string) {
    try {
      logger.debug(`Using item for character ${characterId}, item ${itemId}`);

      if (!itemId) {
        throw new Error('Item ID tidak valid');
      }

      // Get character inventory first
      const inventory = await this.prisma.inventory.findFirst({
        where: {
          characterId,
          itemId,
          quantity: {
            gt: 0
          }
        },
        include: {
          item: true,
          character: true
        }
      });

      // Log inventory query result
      logger.debug('Inventory query result:', {
        found: !!inventory,
        inventoryData: inventory ? {
          id: inventory.id,
          itemId: inventory.itemId,
          characterId: inventory.characterId,
          quantity: inventory.quantity,
          itemName: inventory.item?.name,
          itemEffect: inventory.item?.effect
        } : null
      });

      if (!inventory) {
        // Check if item exists
        const item = await this.prisma.item.findUnique({
          where: { id: itemId }
        });

        // Log item query result
        logger.debug('Item query result:', {
          found: !!item,
          itemData: item ? {
            id: item.id,
            name: item.name
          } : null
        });

        if (!item) {
          throw new Error('Item tidak ditemukan');
        }

        throw new Error(`Kamu tidak memiliki ${item.name} di inventory`);
      }

      const effect = JSON.parse(inventory.item.effect) as ItemEffect;
      
      // Execute everything in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Update inventory quantity first
        const updatedInventory = await tx.inventory.update({
          where: {
            id: inventory.id
          },
          data: {
            quantity: {
              decrement: 1
            }
          }
        });

        logger.debug(`Updated inventory quantity from ${inventory.quantity} to ${updatedInventory.quantity}`);

        // Apply healing effect
        if (effect.type === 'HEAL' || effect.health) {
          const healAmount = effect.value || effect.health || 0;
          const newHealth = Math.min(inventory.character.health + healAmount, inventory.character.maxHealth);
          
          await tx.character.update({
            where: { id: characterId },
            data: { health: newHealth }
          });

          logger.info(`Healed ${inventory.character.name}: ${inventory.character.health} -> ${newHealth} HP`);
        }

        // Apply buff effect
        if ((effect.type === 'BUFF' || effect.type === 'HEAL_AND_BUFF') && effect.stats) {
          const activeBuffs = JSON.parse(inventory.character.activeBuffs || '{"buffs":[]}');
          activeBuffs.buffs.push({
            ...effect.stats,
            expiresAt: Date.now() + (effect.duration || 3600) * 1000
          });

          await tx.character.update({
            where: { id: characterId },
            data: { activeBuffs: JSON.stringify(activeBuffs) }
          });

          logger.info(`Applied buff to ${inventory.character.name}: ${JSON.stringify(effect.stats)}`);
        }

        return { inventory: updatedInventory };
      });

      return { 
        success: true, 
        item: inventory.item, 
        message: `Berhasil menggunakan ${inventory.item.name}` 
      };
    } catch (error) {
      logger.error('Error using item:', error);
      throw error;
    }
  }

  async getInventory(characterId: string) {
    const inventory = await this.prisma.inventory.findMany({
      where: { characterId },
      include: { item: true }
    });

    return inventory.map(inv => ({
      ...inv.item,
      quantity: inv.quantity,
      effect: JSON.parse(inv.item.effect)
    }));
  }

  async getItemChoices(discordId: string): Promise<ApplicationCommandOptionChoiceData[]> {
    try {
      const character = await this.getCharacterOrThrow(discordId);
      
      // Get inventory with items
      const inventory = await this.prisma.inventory.findMany({
        where: { 
          characterId: character.id,
          quantity: {
            gt: 0
          }
        },
        include: { item: true }
      });

      // Log available items with more detail
      logger.debug('Available items for choices:', inventory.map(i => ({
        inventoryId: i.id,
        itemId: i.itemId,
        itemName: i.item.name,
        quantity: i.quantity,
        itemEffect: i.item.effect
      })));

      const choices = inventory.map(inv => ({
        name: `${inv.item.name} (x${inv.quantity})`,
        value: inv.itemId
      }));

      // Log final choices being returned
      logger.debug('Returning item choices:', choices);

      return choices;
    } catch (error) {
      logger.error('Error getting item choices:', error);
      return [];
    }
  }

  async handleInventoryView(source: Message | ChatInputCommandInteraction) {
    try {
      const userId = source instanceof Message ? source.author.id : source.user.id;
      const character = await this.getCharacterOrThrow(userId);
      const inventory = await this.getInventory(character.id);

      if (!inventory.length) {
        return sendResponse(source, { content: '📦 Inventorymu masih kosong!' });
      }

      // Group items by type
      const groupedItems = inventory.reduce((acc, inv) => {
        if (!acc[inv.type]) acc[inv.type] = [];
        acc[inv.type].push({
          name: inv.name,
          description: inv.description,
          quantity: inv.quantity,
          type: inv.type
        });
        return acc;
      }, {} as Record<string, Array<{name: string; description: string; quantity: number; type: string}>>);

      const embed = new EmbedBuilder()
        .setTitle(`📦 Inventory ${character.name}`)
        .setColor('#0099ff');

      for (const [type, items] of Object.entries(groupedItems)) {
        const itemList = items
          .map(item => `${item.name} (x${item.quantity})\n${item.description}`)
          .join('\n\n');

        embed.addFields([{
          name: `${getItemTypeEmoji(type)} ${type}`,
          value: itemList || 'Kosong'
        }]);
      }

      return sendResponse(source, { embeds: [embed] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan';
      return sendResponse(source, { content: `❌ ${message}` });
    }
  }

  async handleUseItem(source: Message | ChatInputCommandInteraction, itemId: string) {
    try {
      if (!itemId) {
        return sendResponse(source, { 
          content: '❌ Silakan pilih item yang ingin digunakan',
          ephemeral: source instanceof ChatInputCommandInteraction
        });
      }

      const userId = source instanceof Message ? source.author.id : source.user.id;
      const character = await this.getCharacterOrThrow(userId);
      
      logger.debug('Handling use item request:', {
        userId,
        characterId: character.id,
        itemId,
        sourceType: source instanceof Message ? 'Message' : 'ChatInputCommandInteraction'
      });

      const result = await this.useItem(character.id, itemId);
      return sendResponse(source, { 
        content: `✅ ${result.message}`,
        ephemeral: source instanceof ChatInputCommandInteraction
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan';
      return sendResponse(source, { 
        content: `❌ ${message}`,
        ephemeral: source instanceof ChatInputCommandInteraction
      });
    }
  }
}