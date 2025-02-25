import { PrismaClient } from '@prisma/client';
import { BaseService } from './BaseService';
import { EmbedBuilder, Message, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import { GameItem, ITEMS } from '../config/gameData';

interface EquipmentSlot {
  equippedWeapon: string | null;
  equippedArmor: string | null;
  equippedAccessory: string | null;
}

interface EquipmentStats {
  attack: number;
  defense: number;
}

interface EquipmentEffect {
  stats?: EquipmentStats;
  durability?: number;
  level?: number;
}

interface EquippedItem {
  id: string;
  name: string;
  type: string;
  description: string;
  effect: EquipmentEffect;
}

export class EquipmentService extends BaseService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async equipItem(characterId: string, itemId: string): Promise<{
    success: boolean;
    message: string;
    embed?: EmbedBuilder;
  }> {
    try {
      // Get character's inventory item
      const inventoryItem = await this.prisma.inventory.findFirst({
        where: {
          characterId,
          itemId,
          quantity: { gt: 0 }
        },
        include: {
          item: true,
          character: true
        }
      });

      if (!inventoryItem) {
        return {
          success: false,
          message: '❌ Item tidak ditemukan di inventory!'
        };
      }

      // Check if item is equipment type
      if (!['WEAPON', 'ARMOR', 'ACCESSORY'].includes(inventoryItem.item.type)) {
        return {
          success: false,
          message: '❌ Item ini tidak bisa diequip!'
        };
      }

      // Get slot based on item type
      const slot = {
        'WEAPON': 'equippedWeapon',
        'ARMOR': 'equippedArmor',
        'ACCESSORY': 'equippedAccessory'
      }[inventoryItem.item.type];

      // Unequip current item in that slot if exists
      const currentEquipped = await this.prisma.inventory.findFirst({
        where: {
          characterId,
          isEquipped: true,
          item: {
            type: inventoryItem.item.type
          }
        },
        include: {
          item: true
        }
      });

      // Process equipment change in transaction
      await this.prisma.$transaction(async (tx) => {
        // Unequip current item if exists
        if (currentEquipped) {
          await tx.inventory.update({
            where: { id: currentEquipped.id },
            data: { 
              isEquipped: false,
              slot: null
            }
          });

          // Remove stats from current equipped item
          const currentEffect = JSON.parse(currentEquipped.item.effect);
          if (currentEffect.stats) {
            await tx.character.update({
              where: { id: characterId },
              data: {
                attack: { 
                  decrement: currentEffect.stats.attack || 0 
                },
                defense: { 
                  decrement: currentEffect.stats.defense || 0 
                }
              }
            });
          }
        }

        // Equip new item
        await tx.inventory.update({
          where: { id: inventoryItem.id },
          data: {
            isEquipped: true,
            slot: inventoryItem.item.type
          }
        });

        // Update character equipment slot
        switch (inventoryItem.item.type) {
          case 'WEAPON':
            await tx.character.update({
              where: { id: characterId },
              data: { equippedWeapon: itemId }
            });
            break;
          case 'ARMOR':
            await tx.character.update({
              where: { id: characterId },
              data: { equippedArmor: itemId }
            });
            break;
          case 'ACCESSORY':
            await tx.character.update({
              where: { id: characterId },
              data: { equippedAccessory: itemId }
            });
            break;
        }

        // Add stats from new item
        const newEffect = JSON.parse(inventoryItem.item.effect);
        if (newEffect.stats) {
          await tx.character.update({
            where: { id: characterId },
            data: {
              attack: { 
                increment: newEffect.stats.attack || 0 
              },
              defense: { 
                increment: newEffect.stats.defense || 0 
              }
            }
          });
        }
      });

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle('⚔️ Equipment Changed!')
        .setColor('#00ff00')
        .setDescription(`${inventoryItem.item.name} telah diequip!`);

      if (currentEquipped) {
        embed.addFields({
          name: '🔄 Equipment Change',
          value: `${currentEquipped.item.name} ➔ ${inventoryItem.item.name}`
        });
      }

      const effect = JSON.parse(inventoryItem.item.effect);
      if (effect.stats) {
        embed.addFields({
          name: '📈 Stats',
          value: Object.entries(effect.stats)
            .map(([stat, value]) => `${stat.toUpperCase()}: +${value}`)
            .join('\n')
        });
      }

      return {
        success: true,
        message: `✅ Berhasil mengequip ${inventoryItem.item.name}!`,
        embed
      };

    } catch (error) {
      this.logger.error('Error equipping item:', error);
      return {
        success: false,
        message: '❌ Terjadi kesalahan saat mengequip item!'
      };
    }
  }

  async unequipItem(characterId: string, slot: 'WEAPON' | 'ARMOR' | 'ACCESSORY'): Promise<{
    success: boolean;
    message: string;
    embed?: EmbedBuilder;
  }> {
    try {
      // Get currently equipped item
      const equippedItem = await this.prisma.inventory.findFirst({
        where: {
          characterId,
          isEquipped: true,
          item: {
            type: slot
          }
        },
        include: {
          item: true
        }
      });

      if (!equippedItem) {
        return {
          success: false,
          message: `❌ Tidak ada ${slot.toLowerCase()} yang diequip!`
        };
      }

      // Process unequip in transaction
      await this.prisma.$transaction(async (tx) => {
        // Unequip item
        await tx.inventory.update({
          where: { id: equippedItem.id },
          data: {
            isEquipped: false,
            slot: null
          }
        });

        // Update character equipment slot
        switch (slot) {
          case 'WEAPON':
            await tx.character.update({
              where: { id: characterId },
              data: { equippedWeapon: null }
            });
            break;
          case 'ARMOR':
            await tx.character.update({
              where: { id: characterId },
              data: { equippedArmor: null }
            });
            break;
          case 'ACCESSORY':
            await tx.character.update({
              where: { id: characterId },
              data: { equippedAccessory: null }
            });
            break;
        }

        // Remove stats from item
        const effect = JSON.parse(equippedItem.item.effect);
        if (effect.stats) {
          await tx.character.update({
            where: { id: characterId },
            data: {
              attack: { 
                decrement: effect.stats.attack || 0 
              },
              defense: { 
                decrement: effect.stats.defense || 0 
              }
            }
          });
        }
      });

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle('🔄 Equipment Removed')
        .setColor('#ff9900')
        .setDescription(`${equippedItem.item.name} telah diunequip!`);

      const effect = JSON.parse(equippedItem.item.effect);
      if (effect.stats) {
        embed.addFields({
          name: '📉 Stats Removed',
          value: Object.entries(effect.stats)
            .map(([stat, value]) => `${stat.toUpperCase()}: -${value}`)
            .join('\n')
        });
      }

      return {
        success: true,
        message: `✅ Berhasil unequip ${equippedItem.item.name}!`,
        embed
      };

    } catch (error) {
      this.logger.error('Error unequipping item:', error);
      return {
        success: false,
        message: '❌ Terjadi kesalahan saat unequip item!'
      };
    }
  }

  async getEquippedItems(characterId: string): Promise<{
    weapon?: EquippedItem;
    armor?: EquippedItem;
    accessory?: EquippedItem;
  }> {
    const equipped = await this.prisma.inventory.findMany({
      where: {
        characterId,
        isEquipped: true
      },
      include: {
        item: true
      }
    });

    const result: {[key: string]: EquippedItem} = {};
    for (const item of equipped) {
      const type = item.item.type.toLowerCase();
      result[type] = {
        id: item.item.id,
        name: item.item.name,
        type: item.item.type,
        description: item.item.description,
        effect: JSON.parse(item.item.effect)
      };
    }

    return result as {
      weapon?: EquippedItem;
      armor?: EquippedItem;
      accessory?: EquippedItem;
    };
  }

  async handleEquipCommand(source: Message | ChatInputCommandInteraction, args: string[] | string) {
    try {
      // Ensure args is array
      const argArray = Array.isArray(args) ? args : args.split(/\s+/);
      
      if (!argArray || argArray.length === 0) {
        const errorMsg = '❌ Format: `a equip [nama_item]`\nContoh: `a equip wooden sword`';
        return source instanceof Message 
          ? source.reply(errorMsg)
          : source.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
      }

      const character = await this.prisma.character.findFirst({
        where: {
          user: {
            discordId: source instanceof Message ? source.author.id : source.user.id
          }
        }
      });

      if (!character) {
        const errorMsg = '❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.';
        return source instanceof Message 
          ? source.reply(errorMsg)
          : source.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
      }

      // Find item by name - join all args as the item name
      const searchName = argArray.join(' ').toLowerCase();
      
      this.logger.debug('Searching for item to equip:', {
        searchName,
        characterId: character.id
      });

      // Get all unequipped items from inventory
      const inventoryItems = await this.prisma.inventory.findMany({
        where: {
          characterId: character.id,
          // Remove isEquipped: false to get all items including equipped ones
          quantity: { gt: 0 }
        },
        include: {
          item: true
        }
      });

      this.logger.debug('Found inventory items:', {
        count: inventoryItems.length,
        items: inventoryItems.map(i => ({
          id: i.itemId,
          name: i.item.name,
          type: i.item.type,
          isEquipped: i.isEquipped
        }))
      });

      // Find item case-insensitive with multiple matching methods
      const inventoryItem = inventoryItems.find(inv => {
        const itemNameLower = inv.item.name.toLowerCase();
        const itemIdLower = inv.itemId.toLowerCase();
        const searchNameLower = searchName.toLowerCase();
        
        // Try exact match with name or id
        if (itemNameLower === searchNameLower || itemIdLower === searchNameLower) {
          return true;
        }
        
        // Remove emojis and try exact match
        const cleanItemName = itemNameLower.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        const cleanSearchName = searchNameLower.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        
        if (cleanItemName === cleanSearchName) {
          return true;
        }
        
        // Try partial match with name or id
        const searchWithUnderscore = searchNameLower.replace(/\s+/g, '_');
        if (cleanItemName.includes(cleanSearchName) || 
            cleanSearchName.includes(cleanItemName) ||
            itemIdLower.includes(searchWithUnderscore) ||
            searchWithUnderscore.includes(itemIdLower)) {
          return true;
        }
        
        return false;
      });

      if (!inventoryItem) {
        this.logger.debug('Item not found:', {
          searchName,
          availableItems: inventoryItems.map(i => ({
            id: i.itemId,
            name: i.item.name
          }))
        });
        const errorMsg = `❌ Item "${searchName}" tidak ditemukan di inventory!`;
        return source instanceof Message 
          ? source.reply(errorMsg)
          : source.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
      }

      this.logger.debug('Found item to equip:', {
        itemId: inventoryItem.itemId,
        itemName: inventoryItem.item.name,
        type: inventoryItem.item.type
      });

      // Check if item is equipment type
      if (!['WEAPON', 'ARMOR', 'ACCESSORY'].includes(inventoryItem.item.type)) {
        const errorMsg = '❌ Item ini tidak bisa diequip!';
        return source instanceof Message 
          ? source.reply(errorMsg)
          : source.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
      }

      // Check if item is already equipped
      if (inventoryItem.isEquipped) {
        const errorMsg = '❌ Item ini sudah diequip!';
        return source instanceof Message 
          ? source.reply(errorMsg)
          : source.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
      }

      const result = await this.equipItem(character.id, inventoryItem.itemId);
      
      if (result.success && result.embed) {
        return source instanceof Message 
          ? source.reply({ embeds: [result.embed] })
          : source.reply({ embeds: [result.embed], flags: MessageFlags.Ephemeral });
      } else {
        return source instanceof Message 
          ? source.reply(result.message)
          : source.reply({ content: result.message, flags: MessageFlags.Ephemeral });
      }
    } catch (error) {
      this.logger.error('Error in handleEquip:', error);
      const errorMsg = '❌ Terjadi kesalahan saat mengequip item.';
      return source instanceof Message 
        ? source.reply(errorMsg)
        : source.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
    }
  }

  async handleUnequipCommand(source: Message | ChatInputCommandInteraction, args: string[] | string) {
    try {
      // Ensure args is array
      const argArray = Array.isArray(args) ? args : args.split(/\s+/);
      
      if (!argArray || argArray.length === 0) {
        const errorMsg = '❌ Format: `a unequip [weapon/armor/accessory]`\nContoh: `a unequip weapon`';
        return source instanceof Message 
          ? source.reply(errorMsg)
          : source.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
      }

      const character = await this.prisma.character.findFirst({
        where: {
          user: {
            discordId: source instanceof Message ? source.author.id : source.user.id
          }
        }
      });

      if (!character) {
        const errorMsg = '❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.';
        return source instanceof Message 
          ? source.reply(errorMsg)
          : source.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
      }

      const slotType = argArray[0].toUpperCase();
      if (!['WEAPON', 'ARMOR', 'ACCESSORY'].includes(slotType)) {
        const errorMsg = '❌ Tipe equipment tidak valid! Gunakan: weapon, armor, atau accessory';
        return source instanceof Message 
          ? source.reply(errorMsg)
          : source.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
      }

      const result = await this.unequipItem(character.id, slotType as 'WEAPON' | 'ARMOR' | 'ACCESSORY');
      
      if (result.success && result.embed) {
        return source instanceof Message 
          ? source.reply({ embeds: [result.embed] })
          : source.reply({ embeds: [result.embed], flags: MessageFlags.Ephemeral });
      } else {
        return source instanceof Message 
          ? source.reply(result.message)
          : source.reply({ content: result.message, flags: MessageFlags.Ephemeral });
      }
    } catch (error) {
      this.logger.error('Error in handleUnequip:', error);
      const errorMsg = '❌ Terjadi kesalahan saat unequip item.';
      return source instanceof Message 
        ? source.reply(errorMsg)
        : source.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
    }
  }
} 