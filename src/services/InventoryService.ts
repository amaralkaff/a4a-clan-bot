import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { BaseService } from './BaseService';
import { Message, EmbedBuilder, ChatInputCommandInteraction, ApplicationCommandOptionChoiceData, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ButtonInteraction, MessageComponentInteraction, InteractionResponse } from 'discord.js';
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
          itemId: itemId.split(' ')[0],
          quantity: {
            gt: 0
          }
        },
        include: {
          item: true,
          character: true
        }
      });

      // Parse quantity from command if provided (e.g., "a u pot 5")
      let quantity = 1;
      const parts = itemId.split(' ');
      const lastPart = parts[parts.length - 1];
      const parsedQuantity = parseInt(lastPart);
      if (!isNaN(parsedQuantity) && parsedQuantity > 0) {
        quantity = Math.min(parsedQuantity, inventory?.quantity || 0);
      }

      // Log inventory query result
      logger.debug('Inventory query result:', {
        found: !!inventory,
        inventoryData: inventory ? {
          id: inventory.id,
          itemId: inventory.itemId,
          characterId: inventory.characterId,
          quantity: inventory.quantity,
          itemName: inventory.item?.name,
          itemEffect: inventory.item?.effect,
          requestedQuantity: parts[parts.length - 1],
          finalQuantity: quantity
        } : null
      });

      if (!inventory) {
        // Check if item exists
        const item = await this.prisma.item.findUnique({
          where: { id: itemId.split(' ')[0] }
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
              decrement: quantity
            }
          }
        });

        logger.debug(`Updated inventory quantity from ${inventory.quantity} to ${updatedInventory.quantity}`);

        let healAmount = 0;
        let newHealth = inventory.character.health;
        let oldHealth = inventory.character.health;

        // Apply healing effect
        if (effect.type === 'HEAL' || effect.health) {
          healAmount = (effect.value || effect.health || 0) * quantity;
          if (healAmount < 0) { // Special case for full heal
            healAmount = inventory.character.maxHealth - inventory.character.health;
          }
          newHealth = Math.min(inventory.character.health + healAmount, inventory.character.maxHealth);
          oldHealth = inventory.character.health;
          
          await tx.character.update({
            where: { id: characterId },
            data: { health: newHealth }
          });

          logger.info(`Healed ${inventory.character.name}: ${oldHealth} -> ${newHealth} HP (${quantity}x potions)`);
        }

        // Apply buff effect
        if ((effect.type === 'BUFF' || effect.type === 'HEAL_AND_BUFF') && effect.stats) {
          const activeBuffs = JSON.parse(inventory.character.activeBuffs || '{"buffs":[]}');
          const buffType = itemId.toUpperCase().replace(/\s+/g, '_');

          // Check if a buff of the same type already exists
          const existingBuffIndex = activeBuffs.buffs.findIndex((buff: any) => buff.type === buffType);
          
          if (existingBuffIndex !== -1) {
            throw new Error(`❌ Kamu sudah memiliki buff dari ${inventory.item.name} yang masih aktif!`);
          }

          activeBuffs.buffs.push({
            type: buffType,
            stats: effect.stats,
            value: Math.max(effect.stats.attack || 0, effect.stats.defense || 0, effect.stats.speed || 0),
            duration: effect.duration || 3600,
            expiresAt: Date.now() + (effect.duration || 3600) * 1000,
            source: itemId
          });

          await tx.character.update({
            where: { id: characterId },
            data: { activeBuffs: JSON.stringify(activeBuffs) }
          });

          logger.info(`Applied buff to ${inventory.character.name}: ${JSON.stringify(effect.stats)}`);
        }

        return { 
          inventory: updatedInventory,
          healAmount,
          oldHealth,
          newHealth,
          effect,
          quantity
        };
      });

      let message = `Berhasil menggunakan ${result.quantity}x ${inventory.item.name}`;
      
      // Add healing info if applicable
      if (result.healAmount > 0) {
        const actualHeal = result.newHealth - result.oldHealth;
        message += ` | ❤️ HP: ${result.oldHealth} → ${result.newHealth} (+${actualHeal})`;
      }

      // Add buff info if applicable
      if (result.effect.stats) {
        const buffDetails = Object.entries(result.effect.stats)
          .map(([stat, value]) => `${stat.charAt(0).toUpperCase() + stat.slice(1)}: +${value}`)
          .join(', ');
        message += ` | ⚡ ${buffDetails} (${result.effect.duration || 60}m)`;
      }

      // Add remaining quantity warning
      const remainingQuantity = result.inventory.quantity;
      if (remainingQuantity <= 3 && remainingQuantity > 0) {
        message += `\n⚠️ Sisa ${inventory.item.name}: ${remainingQuantity}x`;
      } else if (remainingQuantity === 0) {
        message += `\n⚠️ Ini adalah ${inventory.item.name} terakhirmu!`;
      }

      return { 
        success: true, 
        item: inventory.item, 
        message
      };
    } catch (error) {
      logger.error('Error using item:', error);
      throw error;
    }
  }

  async getInventory(characterId: string) {
    const inventory = await this.prisma.inventory.findMany({
      where: { 
        characterId,
        quantity: { gt: 0 } // Only get items with quantity > 0
      },
      include: { item: true }
    });

    return inventory.map(inv => {
      const { item, ...invData } = inv;
      return {
        id: inv.itemId,
        name: item.name,
        description: item.description,
        type: item.type,
        value: item.value,
      quantity: inv.quantity,
        effect: JSON.parse(item.effect),
        isEquipped: inv.isEquipped
      };
    });
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
          id: inv.id,
          name: inv.name,
          description: inv.description,
          quantity: inv.quantity,
          type: inv.type,
          value: Number(inv.value),
          isEquipped: inv.isEquipped
        });
        return acc;
      }, {} as Record<string, Array<{id: string; name: string; description: string; quantity: number; type: string; value: number; isEquipped: boolean}>>);

      const embed = new EmbedBuilder()
        .setTitle(`📦 Inventory ${character.name}`)
        .setColor('#0099ff');

      // Add fields for each type
      for (const [type, items] of Object.entries(groupedItems)) {
        const itemList = items
          .map(item => {
            let text = `${item.name} (x${item.quantity})`;
            if (item.isEquipped) text += ' [Equipped]';
            text += `\n${item.description}`;
            if (item.value) text += `\n💰 Sell value: ${Math.floor(item.value * 0.7)} coins`;
            return text;
          })
          .join('\n\n');

        embed.addFields([{
          name: `${this.getItemTypeEmoji(type)} ${type}`,
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
      
      // Parse itemId and quantity
      const [baseItemId, quantityStr] = itemId.split(' ');
      const quantity = quantityStr ? parseInt(quantityStr) : 1;

      logger.debug('Handling use item request:', {
        userId,
        characterId: character.id,
        baseItemId,
        quantity,
        sourceType: source instanceof Message ? 'Message' : 'ChatInputCommandInteraction'
      });

      const result = await this.useItem(character.id, `${baseItemId} ${quantity}`);
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

  getItemTypeEmoji(type: string): string {
    const emojiMap: { [key: string]: string } = {
      'WEAPON': '⚔️',
      'ARMOR': '🛡️',
      'CONSUMABLE': '🧪',
      'MATERIAL': '📦',
      'QUEST': '📜',
      'SPECIAL': '✨'
    };
    return emojiMap[type] || '❓';
  }

  async calculateEquipmentStats(characterId: string) {
    const inventory = await this.prisma.inventory.findMany({
      where: {
        characterId: characterId,
        isEquipped: true
      },
      include: {
        item: true
      }
    });

    let equipmentStats = {
      attack: 0,
      defense: 0,
      speed: 0
    };

    for (const inv of inventory) {
      const effect = JSON.parse(inv.item.effect);
      if (effect.stats) {
        equipmentStats.attack += effect.stats.attack || 0;
        equipmentStats.defense += effect.stats.defense || 0;
        equipmentStats.speed += effect.stats.speed || 0;
      }
    }

    return equipmentStats;
  }

  async sellItem(characterId: string, itemId: string, quantity: number = 1) {
    try {
      // Get inventory item
      const inventory = await this.prisma.inventory.findFirst({
        where: {
          characterId,
          itemId,
          quantity: { gte: quantity }
        },
        include: {
          item: true,
          character: true
        }
      });

      if (!inventory) {
        throw new Error('Item tidak ditemukan di inventory atau jumlah tidak cukup');
      }

      // Check if item is equipped
      if (inventory.isEquipped) {
        throw new Error('Tidak bisa menjual item yang sedang diequip');
      }

      // Calculate sell price (70% of original price)
      const sellPrice = Math.floor((Number(inventory.item.value) * quantity) * 0.7);

      // Process sale in transaction
      await this.prisma.$transaction(async (tx) => {
        // Remove items from inventory
        if (inventory.quantity === quantity) {
          await tx.inventory.delete({
            where: {
              id: inventory.id
            }
          });
        } else {
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantity: { decrement: quantity }
            }
          });
        }

        // Add coins to character
        await tx.character.update({
          where: {
            id: characterId
          },
          data: {
            coins: { increment: sellPrice }
          }
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            characterId,
            type: 'SHOP_SELL',
            amount: sellPrice,
            description: `Sold ${quantity}x ${inventory.item.name}`
          }
        });
      });

      return {
        success: true,
        itemName: inventory.item.name,
        quantity,
        sellPrice,
        remainingQuantity: inventory.quantity - quantity
      };
    } catch (error) {
      logger.error('Error selling item:', error);
      throw error;
    }
  }

  async handleSellItem(source: Message | ChatInputCommandInteraction, itemId: string | string[], quantity?: number) {
    try {
      const userId = source instanceof Message ? source.author.id : source.user.id;
      const character = await this.getCharacterOrThrow(userId);

      // Parse quantity if provided
      let sellQuantity = quantity || 1;
      if (typeof quantity === 'string') {
        sellQuantity = parseInt(quantity);
        if (isNaN(sellQuantity) || sellQuantity < 1) {
          return sendResponse(source, {
            content: '❌ Jumlah item yang ingin dijual tidak valid',
            ephemeral: source instanceof ChatInputCommandInteraction
          });
        }
      }

      // Get all inventory items first
      const inventoryItems = await this.prisma.inventory.findMany({
        where: {
          characterId: character.id,
          quantity: { gt: 0 }
        },
        include: {
          item: true
        }
      });

      // Clean up search term and try to find matching item
      const searchTerm = Array.isArray(itemId) ? itemId.join(' ') : itemId;
      const cleanSearchTerm = searchTerm.toLowerCase().replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
      
      // Define common aliases
      const aliases: { [key: string]: string[] } = {
        'full_health_potion': ['full', 'full health', 'full hp', 'full heal'],
        'health_potion': ['health', 'hp', 'heal', 'pot', 'potion'],
        'super_health_potion': ['super', 'super health', 'super hp', 'super heal'],
        'meat': ['meat', 'food'],
        'super_meat': ['super meat', 'super food']
      };

      // Find matching item
      let matchedItem = null;
      for (const invItem of inventoryItems) {
        const itemName = invItem.item.name.toLowerCase().replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        
        // Check direct match first
        if (itemName === cleanSearchTerm || invItem.itemId === cleanSearchTerm) {
          matchedItem = invItem;
          break;
        }

        // Check aliases
        for (const [itemId, aliasList] of Object.entries(aliases)) {
          if (invItem.itemId === itemId && aliasList.some(alias => cleanSearchTerm.includes(alias))) {
            matchedItem = invItem;
            break;
          }
        }

        // If still no match, try partial match
        if (!matchedItem && (itemName.includes(cleanSearchTerm) || cleanSearchTerm.includes(itemName))) {
          matchedItem = invItem;
          break;
        }
      }

      if (!matchedItem) {
        return sendResponse(source, {
          content: '❌ Item tidak ditemukan atau jumlah tidak mencukupi!',
          ephemeral: source instanceof ChatInputCommandInteraction
        });
      }

      // Check if item is equipped
      if (matchedItem.isEquipped) {
        return sendResponse(source, {
          content: '❌ Tidak bisa menjual item yang sedang diequip!',
          ephemeral: source instanceof ChatInputCommandInteraction
        });
      }

      // Check if quantity is valid
      if (matchedItem.quantity < sellQuantity) {
        return sendResponse(source, {
          content: `❌ Kamu hanya memiliki ${matchedItem.quantity}x ${matchedItem.item.name}!`,
          ephemeral: source instanceof ChatInputCommandInteraction
        });
      }

      const result = await this.sellItem(character.id, matchedItem.itemId, sellQuantity);

      const embed = new EmbedBuilder()
        .setTitle('💰 Item Sold')
        .setColor('#00ff00')
        .setDescription(`Berhasil menjual ${result.quantity}x ${result.itemName}`)
        .addFields(
          { name: '💰 Coins Received', value: `${result.sellPrice}`, inline: true }
        );

      if (result.remainingQuantity > 0) {
        embed.addFields({
          name: '📦 Remaining', 
          value: `${result.remainingQuantity}x ${result.itemName}`,
          inline: true
        });
      }

      return sendResponse(source, { 
        embeds: [embed],
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

  async addItems(characterId: string, itemId: string, quantity: number): Promise<void> {
    try {
      const item = await this.prisma.item.findUnique({
        where: { id: itemId }
      });

      if (!item) {
        throw new Error('Item not found');
      }

      await this.prisma.inventory.upsert({
        where: {
          characterId_itemId: {
            characterId,
            itemId
          }
        },
        create: {
          characterId,
          itemId,
          quantity,
          durability: item.type === 'WEAPON' || item.type === 'ARMOR' ? 100 : null,
          maxDurability: item.maxDurability || null,
          effect: item.effect,
          stats: item.baseStats || '{}'
        },
        update: {
          quantity: { increment: quantity }
        }
      });
    } catch (error) {
      this.logger.error('Error in addItems:', error);
      throw error;
    }
  }
}