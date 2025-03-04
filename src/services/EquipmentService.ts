import { PrismaClient } from '@prisma/client';
import { BaseService } from './BaseService';
import { EmbedBuilder, Message, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import { GameItem, ITEMS } from '../config/gameData';
import { Cache } from '../utils/Cache';

interface EquipmentSlot {
  equippedWeapon: string | null;
  equippedArmor: string | null;
  equippedAccessory: string | null;
}

interface EquipmentStats {
  attack: number;
  defense: number;
  speed: number;
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

interface CachedEquipment {
  weapon?: EquippedItem;
  armor?: EquippedItem;
  accessory?: EquippedItem;
  lastUpdated: number;
}

export class EquipmentService extends BaseService {
  private equipmentCache: Cache<CachedEquipment>;
  private readonly EQUIPMENT_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

  constructor(prisma: PrismaClient) {
    super(prisma);
    this.equipmentCache = new Cache<CachedEquipment>(this.EQUIPMENT_CACHE_TTL);

    // Set up periodic cache cleanup
    setInterval(() => {
      this.equipmentCache.cleanup();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  private getEquipmentCacheKey(characterId: string): string {
    return `equipment_${characterId}`;
  }

  private ensureStringifiedStats(stats: any): string | null {
    if (!stats) return null;
    return typeof stats === 'string' ? stats : JSON.stringify(stats);
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

      // Check item durability if it has maxDurability
      if (inventoryItem.item.maxDurability !== null) {
        const currentDurability = inventoryItem.durability ?? inventoryItem.item.maxDurability;
        if (currentDurability <= 0) {
          return {
            success: false,
            message: '❌ Item ini sudah rusak dan perlu diperbaiki terlebih dahulu!'
          };
        }
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
              slot: null,
              stats: null  // Clear stats when unequipping
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
                },
                speed: {
                  decrement: currentEffect.stats.speed || 0
                }
              }
            });
          }
        }

        // Parse effect once and reuse
        const newEffect = JSON.parse(inventoryItem.item.effect);
        
        // Equip new item
        await tx.inventory.update({
          where: { id: inventoryItem.id },
          data: {
            isEquipped: true,
            slot: inventoryItem.item.type,
            stats: this.ensureStringifiedStats(newEffect.stats)  // Store stats properly
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
        if (newEffect.stats) {
          await tx.character.update({
            where: { id: characterId },
            data: {
              attack: { 
                increment: newEffect.stats.attack || 0 
              },
              defense: { 
                increment: newEffect.stats.defense || 0 
              },
              speed: {
                increment: newEffect.stats.speed || 0
              }
            }
          });
        }
      });

      // Invalidate equipment cache
      this.equipmentCache.delete(this.getEquipmentCacheKey(characterId));

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

      if (inventoryItem.item.maxDurability !== null) {
        const currentDurability = inventoryItem.durability ?? inventoryItem.item.maxDurability;
        embed.addFields({
          name: '⚒️ Durability',
          value: `${currentDurability}/${inventoryItem.item.maxDurability}`
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

      try {
        // Process unequip in transaction
        await this.prisma.$transaction(async (tx) => {
          // Unequip item
          await tx.inventory.update({
            where: { id: equippedItem.id },
            data: {
              isEquipped: false,
              slot: null,
              stats: null  // Clear stats when unequipping
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
                },
                speed: {
                  decrement: effect.stats.speed || 0
                }
              }
            });
          }
        });

        // Invalidate equipment cache
        this.equipmentCache.delete(this.getEquipmentCacheKey(characterId));

      } catch (txError) {
        this.logger.error('Transaction error in unequipItem:', txError);
        return {
          success: false,
          message: '❌ Terjadi kesalahan saat unequip item!'
        };
      }

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

      if (equippedItem.item.maxDurability !== null) {
        const currentDurability = equippedItem.durability ?? equippedItem.item.maxDurability;
        embed.addFields({
          name: '⚒️ Durability',
          value: `${currentDurability}/${equippedItem.item.maxDurability}`
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
    // Check cache first
    const cacheKey = this.getEquipmentCacheKey(characterId);
    const cachedEquipment = this.equipmentCache.get(cacheKey);
    if (cachedEquipment) {
      return {
        weapon: cachedEquipment.weapon,
        armor: cachedEquipment.armor,
        accessory: cachedEquipment.accessory
      };
    }

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

    // Cache the equipment
    this.equipmentCache.set(cacheKey, {
      weapon: result.weapon,
      armor: result.armor,
      accessory: result.accessory,
      lastUpdated: Date.now()
    });

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

      // Get all unequipped items from inventory that can be equipped
      const inventoryItems = await this.prisma.inventory.findMany({
        where: {
          characterId: character.id,
          quantity: { gt: 0 },
          item: {
            type: {
              in: ['WEAPON', 'ARMOR', 'ACCESSORY']
            }
          }
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

      // Find item using fuzzy search
      const inventoryItem = inventoryItems.find(inv => {
        const itemName = inv.item.name.toLowerCase().replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        const itemId = inv.itemId.toLowerCase();
        const cleanSearchName = searchName.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        const searchWithUnderscore = cleanSearchName.replace(/\s+/g, '_');
        
        return itemName === cleanSearchName || 
               itemId === searchWithUnderscore || 
               itemName.includes(cleanSearchName) || 
               cleanSearchName.includes(itemName);
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