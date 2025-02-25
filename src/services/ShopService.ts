import { PrismaClient } from '@prisma/client';
import { BaseService } from './BaseService';
import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { CharacterService } from './CharacterService';
import { 
  GameItem, 
  ITEMS, 
  RARITY_COLORS, 
  ITEM_TYPE_EMOJIS 
} from '../config/gameData';
import {
  ItemType,
  Rarity,
  Effect,
  EffectType,
  Stats,
  EffectData
} from '../types/game';
import { ChatInputCommandInteraction } from 'discord.js';

const ITEMS_PER_PAGE = 10;

type ShopItemTuple = [string, GameItem];

interface ItemStats extends Stats {
  [key: string]: number | undefined;
}

interface ItemEffect {
  type: EffectType;
  stats?: ItemStats;
  durability?: number;
  maxDurability?: number;
  duration?: number;
  health?: number;
}

interface DbItem {
  id: string;
  name: string;
  type: ItemType;
  description: string;
  value: number;
  effect: string;
  maxDurability?: number | null;
  stackLimit: number;
  rarity: Rarity;
  baseStats: string | null;
  upgradeStats: string | null;
  maxLevel?: number | null;
}

interface ShopItem {
  name: string;
  type: string;
  description: string;
  price: number;
  effect?: string;
  baseStats?: string;
  upgradeStats?: string;
  maxDurability?: number;
  maxLevel?: number;
  stackLimit?: number;
  rarity: string;
}

interface BuyResult {
  success: boolean;
  message: string;
  embed?: EmbedBuilder;
}

// Type guard for EffectData
function isEffectData(effect: unknown): effect is EffectData {
  return typeof effect === 'object' && effect !== null && 'type' in effect;
}

// Helper function to convert effect to string for database
function effectToDbString(effect: Effect | undefined): string {
  if (!effect) return '{}';
  if (typeof effect === 'string') return effect;
  return JSON.stringify(effect);
}

// Helper function to parse effect string from database
function parseDbEffect(effectStr: string): EffectData | undefined {
  if (!effectStr || effectStr === '{}') return undefined;
  try {
    const parsed = JSON.parse(effectStr);
    if (isEffectData(parsed)) {
      return parsed;
    }
    return undefined;
  } catch (error) {
    return undefined;
  }
}

// Helper function to get effect data from any effect type
function getEffectData(effect: Effect | undefined): EffectData | undefined {
  if (!effect) return undefined;
  if (typeof effect === 'string') return parseDbEffect(effect);
  return effect;
}

// Helper function to format stat value
function formatStatValue(value: number | undefined): string {
  if (value === undefined) return '0';
  return value > 0 ? `+${value}` : `${value}`;
}

// Type guard untuk memvalidasi item tuple
function isShopItemTuple(tuple: [string, any]): tuple is ShopItemTuple {
  const [_, item] = tuple;
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof item.name === 'string' &&
    typeof item.type === 'string' &&
    typeof item.description === 'string' &&
    typeof item.price === 'number' &&
    typeof item.rarity === 'string'
  );
}

export class ShopService extends BaseService {
  private characterService: CharacterService;

  constructor(prisma: PrismaClient, characterService: CharacterService) {
    super(prisma);
    this.characterService = characterService;
  }

  private createShopEmbed(items: GameItem[], page: number, totalPages: number, balance: number) {
    const embed = new EmbedBuilder()
      .setTitle('🛍️ A4A CLAN Shop')
      .setColor('#ffd700')
      .setDescription(`💰 Uangmu: ${balance} coins\nGunakan \`a buy [nama_item] [jumlah]\` untuk membeli item.`)
      .setFooter({ text: `Halaman ${page + 1}/${totalPages} • Contoh: a buy potion 5` });

    // Group items by type for current page
    const groupedItems: Record<string, GameItem[]> = {};
    const startIdx = page * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, items.length);
    
    for (let i = startIdx; i < endIdx; i++) {
      const item = items[i];
      const type = item.type;
      if (!groupedItems[type]) {
        groupedItems[type] = [];
      }
      groupedItems[type].push(item);
    }

    // Add fields for each type
    for (const [type, typeItems] of Object.entries(groupedItems)) {
      let fieldValue = '';
      
      for (const item of typeItems) {
        let itemText = `${item.name} - 💰 ${item.price} coins\n${item.description}`;

        // Only parse effect if it exists and is not empty
        if (item.effect && item.effect !== '{}') {
          try {
            const effect = getEffectData(item.effect);
            if (effect && effect.stats) {
              const statsText = Object.entries(effect.stats)
                .map(([stat, value]) => `${stat === 'attack' ? '⚔️' : '🛡️'} ${stat.toUpperCase()}: ${formatStatValue(value)}`)
                .join(', ');
              if (statsText) {
                itemText += `\n${statsText}`;
              }
            }
          } catch (error) {
            // Silently handle JSON parse errors
            console.error('Error parsing item effect:', error);
          }
        }

        // Add rarity indicator
        const rarityEmoji = {
          'COMMON': '⚪',
          'UNCOMMON': '🟢',
          'RARE': '🔵',
          'EPIC': '🟣',
          'LEGENDARY': '🟡'
        }[item.rarity] || '⚪';
        
        itemText = `${rarityEmoji} ${itemText}`;

        // Check if adding this item would exceed Discord's limit
        if ((fieldValue + '\n\n' + itemText).length > 1024) {
          // If it would exceed, create a new field
          const typeEmoji = ITEM_TYPE_EMOJIS[type as keyof typeof ITEM_TYPE_EMOJIS] || '📦';
          embed.addFields({
            name: `${typeEmoji} ${type} (Lanjutan)`,
            value: fieldValue
          });
          fieldValue = itemText;
        } else {
          fieldValue += (fieldValue ? '\n\n' : '') + itemText;
        }
      }

      // Add the last field for this type
      if (fieldValue) {
        const typeEmoji = ITEM_TYPE_EMOJIS[type as keyof typeof ITEM_TYPE_EMOJIS] || '📦';
        embed.addFields({
          name: `${typeEmoji} ${type}`,
          value: fieldValue
        });
      }
    }

    return embed;
  }

  async handleShop(message: Message, args?: string[]) {
    try {
      const character = await this.characterService.getCharacterByDiscordId(message.author.id);
      
      if (!character) {
        return message.reply('❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.');
      }

      // Get character balance
      const balance = await this.characterService.getBalance(character.id);

      // Convert items to array and sort by type and price
      let itemsArray = Object.entries(ITEMS)
        .filter(isShopItemTuple)
        .map(([id, item]) => ({
          id,
          ...item
        } as GameItem));

      // Filter by type if argument is provided
      if (args && args.length > 0) {
        const filterType = args[0].toUpperCase();
        const validTypes = ['WEAPON', 'ARMOR', 'ACCESSORY', 'CONSUMABLE', 'MATERIAL'];
        
        if (!validTypes.includes(filterType)) {
          return message.reply('❌ Tipe item tidak valid! Gunakan: weapon, armor, accessory, consumable, atau material');
        }

        itemsArray = itemsArray.filter(item => item.type === filterType);
        
        if (itemsArray.length === 0) {
          return message.reply(`❌ Tidak ada item dengan tipe ${filterType.toLowerCase()} di shop!`);
        }
      }

      // Sort by type and price
      itemsArray.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        }
        return a.price - b.price;
      });

      const totalPages = Math.ceil(itemsArray.length / ITEMS_PER_PAGE);
      let currentPage = 0;

      // Create initial embed
      const embed = this.createShopEmbed(itemsArray, currentPage, totalPages, balance.coins);

      // Add filter info if filtered
      if (args && args.length > 0) {
        embed.setTitle(`🛍️ A4A CLAN Shop - ${args[0].toUpperCase()}`);
      }

      // Create navigation buttons
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('◀️ Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(totalPages <= 1)
        );

      // Add filter buttons
      const filterRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('filter_weapon')
            .setLabel('⚔️ Weapon')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('filter_armor')
            .setLabel('🛡️ Armor')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('filter_accessory')
            .setLabel('💍 Accessory')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('filter_consumable')
            .setLabel('🧪 Consumable')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('filter_all')
            .setLabel('🔄 Show All')
            .setStyle(ButtonStyle.Secondary)
        );

      // Send initial message with buttons
      const shopMessage = await message.reply({
        embeds: [embed],
        components: [filterRow, row]
      });

      // Create button collector
      const collector = shopMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000 // 5 minutes
      });

      collector.on('collect', async (interaction) => {
        if (interaction.user.id !== message.author.id) {
          await interaction.reply({
            content: '❌ Kamu tidak bisa menggunakan tombol ini!',
            ephemeral: true
          });
          return;
        }

        // Handle filter buttons
        if (interaction.customId.startsWith('filter_')) {
          const filterType = interaction.customId.replace('filter_', '').toUpperCase();
          
          // Reset to original array for "Show All"
          if (filterType === 'ALL') {
            itemsArray = Object.entries(ITEMS)
              .filter(isShopItemTuple)
              .map(([id, item]) => ({
                id,
                ...item
              } as GameItem))
              .sort((a, b) => {
                if (a.type !== b.type) return a.type.localeCompare(b.type);
                return a.price - b.price;
              });
          } else {
            // Filter items by type
            itemsArray = Object.entries(ITEMS)
              .filter(isShopItemTuple)
              .map(([id, item]) => ({
                id,
                ...item
              } as GameItem))
              .filter(item => item.type === filterType)
              .sort((a, b) => a.price - b.price);
          }

          currentPage = 0;
          const totalPages = Math.ceil(itemsArray.length / ITEMS_PER_PAGE);
          
          // Update embed
          const newEmbed = this.createShopEmbed(itemsArray, currentPage, totalPages, balance.coins);
          if (filterType !== 'ALL') {
            newEmbed.setTitle(`🛍️ A4A CLAN Shop - ${filterType}`);
          }

          // Update button states
          const buttons = row.components;
          buttons[0].setDisabled(true);
          buttons[1].setDisabled(totalPages <= 1);

          await interaction.update({
            embeds: [newEmbed],
            components: [filterRow, row]
          });
          return;
        }

        // Handle navigation buttons
        if (interaction.customId === 'prev') {
          currentPage--;
        } else if (interaction.customId === 'next') {
          currentPage++;
        }

        // Update button states
        const buttons = row.components;
        buttons[0].setDisabled(currentPage === 0);
        buttons[1].setDisabled(currentPage === totalPages - 1);

        // Create new embed for current page
        const newEmbed = this.createShopEmbed(itemsArray, currentPage, totalPages, balance.coins);

        // Update message
        await interaction.update({
          embeds: [newEmbed],
          components: [filterRow, row]
        });
      });

      collector.on('end', () => {
        // Remove buttons after timeout
        shopMessage.edit({
          components: []
        }).catch(() => {});
      });

    } catch (error) {
      this.logger.error('Error in shop handler:', error);
      return message.reply('❌ Terjadi kesalahan saat membuka shop.');
    }
  }

  async handleBuyCommand(message: Message, args: string[] | string) {
    try {
      // Ensure args is array
      const argArray = Array.isArray(args) ? args : args.split(/\s+/);
      
      if (!argArray || argArray.length === 0) {
        return message.reply('❌ Format: `a buy [nama_item] [jumlah]`\nContoh: `a buy potion 5`');
      }

      const character = await this.characterService.getCharacterByDiscordId(message.author.id);
      
      if (!character) {
        return message.reply('❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.');
      }

      // Parse quantity from last argument if it's a number
      let quantity = 1;
      let itemName = '';
      
      const lastArg = argArray[argArray.length - 1];
      if (!isNaN(parseInt(lastArg))) {
        quantity = Math.max(1, parseInt(lastArg)); // Ensure minimum 1
        itemName = argArray.slice(0, -1).join(' ').toLowerCase();
      } else {
        itemName = argArray.join(' ').toLowerCase();
      }

      this.logger.debug('Searching for item:', {
        searchName: itemName,
        quantity: quantity,
        args: argArray
      });

      // Find item by name
      const itemEntry = Object.entries(ITEMS)
        .find(([_, item]) => {
          const itemNameLower = (item as ShopItem).name.toLowerCase();
          const searchNameLower = itemName.toLowerCase();
          
          // Try exact match first
          if (itemNameLower === searchNameLower) {
            return true;
          }
          
          // Remove emojis for comparison
          const cleanItemName = itemNameLower.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
          const cleanSearchName = searchNameLower.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
          
          // Try partial match without emojis
          return cleanItemName.includes(cleanSearchName) || cleanSearchName.includes(cleanItemName);
        });

      if (!itemEntry) {
        this.logger.debug('Item not found:', {
          searchName: itemName,
          availableItems: Object.keys(ITEMS)
        });
        return message.reply(`❌ Item "${itemName}" tidak ditemukan di shop!`);
      }

      const [itemId, item] = itemEntry as [string, ShopItem];
      
      this.logger.debug('Found item:', {
        itemId,
        itemName: item.name,
        type: item.type,
        price: item.price
      });

      // Check if item exists in database
      const dbItem = await this.prisma.item.findUnique({
        where: { id: itemId }
      });

      if (!dbItem) {
        // Create item in database if it doesn't exist
        try {
          this.logger.debug('Creating item in database:', {
            itemId,
            itemName: item.name
          });

          await this.prisma.item.create({
            data: {
              id: itemId,
              name: item.name,
              description: item.description,
              type: item.type,
              value: item.price,
              effect: effectToDbString(item.effect),
              maxDurability: item.maxDurability,
              rarity: item.rarity,
              baseStats: item.baseStats || '{}',
              upgradeStats: item.upgradeStats || '{}',
              maxLevel: item.maxLevel
            }
          });
        } catch (error) {
          this.logger.error('Error creating item in database:', {
            error,
            itemId,
            itemName: item.name
          });
          return message.reply('❌ Terjadi kesalahan saat membeli item. Silakan coba lagi.');
        }
      }

      const totalPrice = item.price * quantity;

      // Check if character has enough coins
      const balance = await this.characterService.getBalance(character.id);
      if (balance.coins < totalPrice) {
        return message.reply(`❌ Uang tidak cukup! Kamu butuh ${totalPrice} coins untuk membeli ${quantity}x ${item.name}.`);
      }

      this.logger.debug('Processing purchase:', {
        characterId: character.id,
        itemId,
        quantity,
        totalPrice,
        currentBalance: balance.coins
      });

      // Process purchase in transaction
      await this.prisma.$transaction(async (tx) => {
        // Remove coins
        await tx.character.update({
          where: { id: character.id },
          data: { coins: { decrement: totalPrice } }
        });

        // Add item to inventory
        await tx.inventory.upsert({
          where: {
            characterId_itemId: {
              characterId: character.id,
              itemId
            }
          },
          create: {
            characterId: character.id,
            itemId,
            quantity,
            durability: item.type === 'WEAPON' || item.type === 'ARMOR' ? 100 : null,
            maxDurability: item.maxDurability || null,
            effect: effectToDbString(item.effect),
            stats: item.baseStats || null
          },
          update: {
            quantity: { increment: quantity }
          }
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            characterId: character.id,
            type: 'SHOP_PURCHASE',
            amount: -totalPrice,
            description: `Bought ${quantity}x ${item.name}`
          }
        });
      });

      this.logger.debug('Purchase successful:', {
        characterId: character.id,
        itemId,
        quantity,
        totalPrice,
        newBalance: balance.coins - totalPrice
      });

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle('🛍️ Pembelian Berhasil!')
        .setColor('#00ff00')
        .setDescription(`Kamu telah membeli ${quantity}x ${item.name} seharga ${totalPrice} coins.`)
        .addFields(
          { name: '💰 Sisa Uang', value: `${balance.coins - totalPrice} coins`, inline: true },
          { name: '📦 Item', value: `${item.name}\n${item.description}`, inline: true }
        );

      // Add stats info if equipment
      if (item.effect) {
        try {
          const effect = getEffectData(item.effect);
          if (effect && effect.stats) {
            const statsText = Object.entries(effect.stats)
              .map(([stat, value]) => `${stat === 'attack' ? '⚔️' : '🛡️'} ${stat.toUpperCase()}: ${formatStatValue(value)}`)
              .join('\n');
            
            embed.addFields({
              name: '📊 Stats',
              value: statsText,
              inline: true
            });
          }
        } catch (error) {
          this.logger.error('Error parsing item effect:', error);
        }
      }

      return message.reply({ embeds: [embed] });

    } catch (error) {
      this.logger.error('Error in buy command:', error);
      return message.reply('❌ Terjadi kesalahan saat membeli item.');
    }
  }

  // Add new method for slash command buying
  async buyItemSlash(interaction: ChatInputCommandInteraction, itemId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const character = await this.characterService.getCharacterByDiscordId(interaction.user.id);
      
      if (!character) {
        return {
          success: false,
          message: '❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.'
        };
      }

      // Find item in shop
      const item = ITEMS[itemId];
      if (!item) {
        return {
          success: false,
          message: `❌ Item "${itemId}" tidak ditemukan di shop!`
        };
      }

      // Check if character has enough coins
      const balance = await this.characterService.getBalance(character.id);
      if (balance.coins < item.price) {
        return {
          success: false,
          message: `❌ Uang tidak cukup! Kamu butuh ${item.price} coins untuk membeli ${item.name}.`
        };
      }

      // Process purchase in transaction
      await this.prisma.$transaction(async (tx) => {
        // Remove coins
        await tx.character.update({
          where: { id: character.id },
          data: { coins: { decrement: item.price } }
        });

        // Add item to inventory
        await tx.inventory.upsert({
          where: {
            characterId_itemId: {
              characterId: character.id,
              itemId
            }
          },
          create: {
            characterId: character.id,
            itemId,
            quantity: 1,
            durability: item.type === 'WEAPON' || item.type === 'ARMOR' ? 100 : null,
            maxDurability: item.maxDurability || null,
            effect: JSON.stringify(item.effect || {}),
            stats: JSON.stringify(item.baseStats || {})
          },
          update: {
            quantity: { increment: 1 }
          }
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            characterId: character.id,
            type: 'SHOP_PURCHASE',
            amount: -item.price,
            description: `Bought ${item.name}`
          }
        });
      });

      return {
        success: true,
        message: `✅ Berhasil membeli ${item.name} seharga ${item.price} coins!`
      };

    } catch (error) {
      this.logger.error('Error in buyItemSlash:', error);
      return {
        success: false,
        message: '❌ Terjadi kesalahan saat membeli item.'
      };
    }
  }
} 