import { PrismaClient } from '@prisma/client';
import { BaseService } from './BaseService';
import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { CharacterService } from './CharacterService';
import { InventoryService } from './InventoryService';
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
  id: string;
  name: string;
  description: string;
  type: string;
  price: number;
  effect: Effect;
  baseStats?: string;
  upgradeStats?: string;
  maxDurability?: number | null;
  stackLimit: number;
  rarity: string;
  maxLevel?: number | null;
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

// Helper function to convert GameItem to ShopItem
function convertGameItemToShopItem(id: string, gameItem: GameItem): ShopItem {
  return {
    id,
    name: gameItem.name,
    description: gameItem.description,
    type: gameItem.type,
    price: gameItem.price,
    effect: gameItem.effect,
    baseStats: JSON.stringify(gameItem.baseStats || {}),
    upgradeStats: JSON.stringify(gameItem.upgradeStats || {}),
    maxDurability: gameItem.maxDurability || null,
    stackLimit: gameItem.stackLimit,
    rarity: gameItem.rarity,
    maxLevel: gameItem.maxLevel || null
  };
}

// Create shop items map
const shopItems: Map<string, ShopItem> = new Map(
  Object.entries(ITEMS).map(
    ([id, item]) => [id, convertGameItemToShopItem(id, item)]
  )
);

export class ShopService extends BaseService {
  private characterService: CharacterService;
  private inventoryService: InventoryService;

  constructor(prisma: PrismaClient, characterService: CharacterService) {
    super(prisma);
    this.characterService = characterService;
    this.inventoryService = new InventoryService(prisma, characterService);
  }

  private createShopEmbed(items: GameItem[], page: number, totalPages: number, balance: number) {
    const embed = new EmbedBuilder()
      .setTitle('🛍️ A4A CLAN Shop')
      .setColor('#ffd700')
      .setDescription(`💰 Uangmu: ${balance} coins`)
      .setFooter({ text: `Halaman ${page + 1}/${totalPages}` });

    // Group items by type for current page
    const groupedItems: Record<string, GameItem[]> = {};
    const startIdx = page * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, items.length);
    
    // Check if we have items for this page
    if (startIdx >= items.length) {
      // If we're past the last item, go back to the last valid page
      page = Math.max(0, Math.ceil(items.length / ITEMS_PER_PAGE) - 1);
      const newStartIdx = page * ITEMS_PER_PAGE;
      const newEndIdx = Math.min(newStartIdx + ITEMS_PER_PAGE, items.length);
      
      // Update items for the corrected page
      for (let i = newStartIdx; i < newEndIdx; i++) {
        const item = items[i];
        const type = item.type;
        if (!groupedItems[type]) {
          groupedItems[type] = [];
        }
        groupedItems[type].push(item);
      }
    } else {
      // Normal case - process items for current page
      for (let i = startIdx; i < endIdx; i++) {
        const item = items[i];
        const type = item.type;
        if (!groupedItems[type]) {
          groupedItems[type] = [];
        }
        groupedItems[type].push(item);
      }
    }

    // Add fields for each type
    for (const [type, typeItems] of Object.entries(groupedItems)) {
      let fieldValue = '';
      
      for (const item of typeItems) {
        let itemText = `${item.name} - 💰 ${item.price} coins\n${item.description}`;

        // Add stats if item has effect
        if (item.effect) {
          const effectData = getEffectData(item.effect);
          if (effectData?.stats) {
            const stats = Object.entries(effectData.stats)
              .map(([stat, value]) => `${stat === 'attack' ? '⚔️' : '🛡️'} ${stat.toUpperCase()}: ${formatStatValue(value)}`)
              .join(', ');
            if (stats) {
              itemText += `\n${stats}`;
            }
          }
        }

        const rarityEmoji = {
          'COMMON': '⚪',
          'UNCOMMON': '🟢',
          'RARE': '🔵',
          'EPIC': '🟣',
          'LEGENDARY': '🟡',
          'MYTHICAL': '🟣',
          'DIVINE': '🟣',
          'TRANSCENDENT': '🟣',
          'CELESTIAL': '🟣',
          'PRIMORDIAL': '🟣'
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

    // If no items were added, add a message
    if (embed.data.fields?.length === 0) {
      embed.addFields({
        name: '❌ Tidak ada item',
        value: 'Tidak ada item yang ditemukan di halaman ini.'
      });
    }

    return embed;
  }

  private createBuyButtons(items: GameItem[], startIdx: number, endIdx: number) {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();
    let buttonCount = 0;

    for (let i = startIdx; i < endIdx; i++) {
      const item = items[i];
      if (!item) continue;

      // Create buy button for item using array index
      const button = new ButtonBuilder()
        .setCustomId(`buy_${i}_1`) // Use array index instead of item.id
        .setLabel(`Buy ${item.name}`)
        .setStyle(ButtonStyle.Success)
        .setEmoji('🛒');

      // Discord allows max 5 buttons per row
      if (buttonCount % 5 === 0 && buttonCount !== 0) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder<ButtonBuilder>();
      }

      currentRow.addComponents(button);
      buttonCount++;
    }

    // Add the last row if it has any buttons
    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }

    return rows;
  }

  async handleShop(message: Message, args?: string[]) {
    try {
      const character = await this.characterService.getCharacterByDiscordId(message.author.id);
      
      if (!character) {
        return message.reply('❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.');
      }

      // Get character balance
      const balance = await this.characterService.getBalance(character.id);

      // Get items from database
      const dbItems = await this.prisma.item.findMany();
      
      // Convert DB items to GameItem format and merge with ITEMS
      const mergedItems = {
        ...ITEMS,
        ...Object.fromEntries(
          dbItems.map(dbItem => [
            dbItem.id,
            {
              name: dbItem.name,
              type: dbItem.type,
              description: dbItem.description,
              price: dbItem.value,
              effect: parseDbEffect(dbItem.effect) || {},
              baseStats: dbItem.baseStats ? JSON.parse(dbItem.baseStats) : {},
              upgradeStats: dbItem.upgradeStats ? JSON.parse(dbItem.upgradeStats) : {},
              maxDurability: dbItem.maxDurability || undefined,
              stackLimit: dbItem.stackLimit,
              rarity: dbItem.rarity,
              maxLevel: dbItem.maxLevel || undefined
            } as GameItem
          ])
        )
      };

      // Convert items to array and sort by type and price
      let itemsArray = Object.entries(mergedItems)
        .filter(isShopItemTuple)
        .map(([id, item]) => ({
          id,
          ...item
        } as GameItem));

      // Filter by type if argument is provided
      if (args && args.length > 0) {
        const filterType = args[0].toUpperCase();
        const validTypes: ItemType[] = ['WEAPON', 'ARMOR', 'ACCESSORY', 'CONSUMABLE', 'MATERIAL'];
        
        if (!validTypes.includes(filterType as ItemType) && filterType !== 'DEVIL_FRUIT') {
          return message.reply('❌ Tipe item tidak valid! Gunakan: weapon, armor, accessory, consumable, material, atau devil_fruit');
        }

        if (filterType === 'DEVIL_FRUIT') {
          itemsArray = itemsArray.filter(item => item.name.toLowerCase().includes('no mi'));
        } else {
          itemsArray = itemsArray.filter(item => item.type === filterType as ItemType);
        }
        
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

      // Create navigation and filter buttons
      const navigationRow = new ActionRowBuilder<ButtonBuilder>()
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

      // Create filter buttons
      const filterRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('filter_WEAPON')
            .setLabel(`${ITEM_TYPE_EMOJIS.WEAPON} Weapon`)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('filter_ARMOR')
            .setLabel(`${ITEM_TYPE_EMOJIS.ARMOR} Armor`)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('filter_ACCESSORY')
            .setLabel(`${ITEM_TYPE_EMOJIS.ACCESSORY} Accessory`)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('filter_CONSUMABLE')
            .setLabel(`${ITEM_TYPE_EMOJIS.CONSUMABLE} Consumable`)
            .setStyle(ButtonStyle.Secondary)
        );

      // Create buy buttons for current page
      const buyButtonRows = this.createBuyButtons(
        itemsArray,
        currentPage * ITEMS_PER_PAGE,
        Math.min((currentPage + 1) * ITEMS_PER_PAGE, itemsArray.length)
      );

      // Combine all button rows
      const allComponents = [filterRow, ...buyButtonRows, navigationRow];

      // Send initial message with buttons
      const shopMessage = await message.reply({
        embeds: [embed],
        components: allComponents
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

        let allComponents: ActionRowBuilder<ButtonBuilder>[];

        // Handle buy buttons
        if (interaction.customId.startsWith('buy_')) {
          const [_, indexStr, quantityStr] = interaction.customId.split('_');
          const index = parseInt(indexStr);
          const quantity = parseInt(quantityStr);
          
          // Get item from array using index
          const item = itemsArray[index];
          if (!item) {
            await interaction.reply({
              content: '❌ Item tidak ditemukan!',
              ephemeral: true
            });
            return;
          }

          // Get fresh character data
          const updatedCharacter = await this.characterService.getCharacterByDiscordId(interaction.user.id);
          if (!updatedCharacter) {
            await interaction.reply({
              content: '❌ Character tidak ditemukan!',
              ephemeral: true
            });
            return;
          }
          
          const updatedBalance = await this.characterService.getBalance(updatedCharacter.id);

          // Check if character has enough coins
          if (updatedBalance.coins < item.price * quantity) {
            await interaction.reply({
              content: `❌ Uang tidak cukup! Kamu butuh ${item.price * quantity} coins untuk membeli ${quantity}x ${item.name}.`,
              ephemeral: true
            });
            return;
          }

          try {
            // Find item ID from original ITEMS object
            const itemId = Object.entries(ITEMS).find(([_, i]) => i.name === item.name)?.[0];
            if (!itemId) {
              await interaction.reply({
                content: '❌ Item tidak ditemukan di database!',
                ephemeral: true
              });
              return;
            }

            // Process purchase
            await this.processPurchase(updatedCharacter.id, itemId, quantity, item);

            // Send success message
            await interaction.reply({
              content: `✅ Berhasil membeli ${quantity}x ${item.name} seharga ${item.price * quantity} coins!`,
              ephemeral: true
            });

            // Update shop embed with new balance
            const newBalance = await this.characterService.getBalance(updatedCharacter.id);
            const updatedEmbed = this.createShopEmbed(itemsArray, currentPage, totalPages, newBalance.coins);

            // Create new buy buttons for current page
            const buyButtonRows = this.createBuyButtons(
              itemsArray,
              currentPage * ITEMS_PER_PAGE,
              Math.min((currentPage + 1) * ITEMS_PER_PAGE, itemsArray.length)
            );

            // Combine all button rows
            allComponents = [filterRow, ...buyButtonRows, navigationRow];

            await shopMessage.edit({
              embeds: [updatedEmbed],
              components: allComponents
            });
          } catch (error) {
            this.logger.error('Error processing purchase:', error);
            await interaction.reply({
              content: '❌ Terjadi kesalahan saat membeli item.',
              ephemeral: true
            });
          }
          return;
        }

        // Handle filter buttons
        if (interaction.customId.startsWith('filter_')) {
          const filterType = interaction.customId.replace('filter_', '') as ItemType | 'ALL' | 'DEVIL_FRUIT';
          
          // Get items from database again to ensure fresh data
          const dbItems = await this.prisma.item.findMany();
          
          // Convert DB items to GameItem format and merge with ITEMS
          const mergedItems = {
            ...ITEMS,
            ...Object.fromEntries(
              dbItems.map(dbItem => [
                dbItem.id,
                {
                  name: dbItem.name,
                  type: dbItem.type,
                  description: dbItem.description,
                  price: dbItem.value,
                  effect: parseDbEffect(dbItem.effect) || {},
                  baseStats: dbItem.baseStats ? JSON.parse(dbItem.baseStats) : {},
                  upgradeStats: dbItem.upgradeStats ? JSON.parse(dbItem.upgradeStats) : {},
                  maxDurability: dbItem.maxDurability || undefined,
                  stackLimit: dbItem.stackLimit,
                  rarity: dbItem.rarity,
                  maxLevel: dbItem.maxLevel || undefined
                } as GameItem
              ])
            )
          };

          // Reset to original array for "Show All"
          if (filterType === 'ALL') {
            itemsArray = Object.entries(mergedItems)
              .filter(isShopItemTuple)
              .map(([id, item]) => ({
                id,
                ...item
              } as GameItem))
              .sort((a, b) => {
                if (a.type !== b.type) return a.type.localeCompare(b.type);
                return a.price - b.price;
              });
          } else if (filterType === 'DEVIL_FRUIT') {
            // Filter Devil Fruit items
            itemsArray = Object.entries(mergedItems)
              .filter(isShopItemTuple)
              .map(([id, item]) => ({
                id,
                ...item
              } as GameItem))
              .filter(item => item.name.toLowerCase().includes('no mi'))
              .sort((a, b) => a.price - b.price);
          } else {
            // Filter items by type using ItemType enum
            itemsArray = Object.entries(mergedItems)
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
          if (filterType === 'DEVIL_FRUIT') {
            newEmbed.setTitle('🛍️ A4A CLAN Shop - 🍎 Devil Fruits');
          } else if (filterType !== 'ALL') {
            newEmbed.setTitle(`🛍️ A4A CLAN Shop - ${ITEM_TYPE_EMOJIS[filterType as keyof typeof ITEM_TYPE_EMOJIS] || '📦'} ${filterType}`);
          }

          // Update button states
          const buttons = navigationRow.components;
          buttons[0].setDisabled(true);
          buttons[1].setDisabled(totalPages <= 1);

          // Create new buy buttons for filtered items
          const buyButtonRows = this.createBuyButtons(
            itemsArray,
            currentPage * ITEMS_PER_PAGE,
            Math.min((currentPage + 1) * ITEMS_PER_PAGE, itemsArray.length)
          );

          // Combine all button rows
          allComponents = [filterRow, ...buyButtonRows, navigationRow];

          await interaction.update({
            embeds: [newEmbed],
            components: allComponents
          });
          return;
        }

        // Handle navigation buttons
        if (interaction.customId === 'prev') {
          if (currentPage > 0) {
            currentPage--;
          }
        } else if (interaction.customId === 'next') {
          if (currentPage < totalPages - 1) {
            currentPage++;
          }
        }

        // Update button states
        const buttons = navigationRow.components;
        buttons[0].setDisabled(currentPage === 0);
        buttons[1].setDisabled(currentPage === totalPages - 1);

        // Create new embed for current page
        const newEmbed = this.createShopEmbed(itemsArray, currentPage, totalPages, balance.coins);

        // Create new buy buttons for current page
        const buyButtonRows = this.createBuyButtons(
          itemsArray,
          currentPage * ITEMS_PER_PAGE,
          Math.min((currentPage + 1) * ITEMS_PER_PAGE, itemsArray.length)
        );

        // Combine all button rows
        allComponents = [filterRow, ...buyButtonRows, navigationRow];

        // Update message
        await interaction.update({
          embeds: [newEmbed],
          components: allComponents
        });
      });

      collector.on('end', () => {
        shopMessage.edit({
          components: []
        }).catch(() => {});
      });

    } catch (error) {
      this.logger.error('Error in shop handler:', error);
      return message.reply('❌ Terjadi kesalahan saat membuka shop.');
    }
  }

  private async processPurchase(characterId: string, itemId: string, quantity: number, item: GameItem) {
    await this.prisma.$transaction(async (tx) => {
      // Remove coins
      const totalPrice = item.price * quantity;
      await tx.character.update({
        where: { id: characterId },
        data: { coins: { decrement: totalPrice } }
      });

      // Add item to inventory
      await tx.inventory.upsert({
        where: {
          characterId_itemId: {
            characterId: characterId,
            itemId
          }
        },
        create: {
          characterId,
          itemId,
          quantity,
          durability: item.type === 'WEAPON' || item.type === 'ARMOR' ? 100 : null,
          maxDurability: item.maxDurability || null,
          effect: JSON.stringify(item.effect || {}),
          stats: JSON.stringify(item.baseStats || {})
        },
        update: {
          quantity: { increment: quantity }
        }
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          characterId,
          type: 'SHOP_PURCHASE',
          amount: -totalPrice,
          description: `Bought ${quantity}x ${item.name}`
        }
      });
    });
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
          // Keep emojis in the comparison
          const itemNameLower = item.name.toLowerCase();
          const searchNameLower = itemName.toLowerCase();
          
          // Try exact match first (with emojis)
          if (itemNameLower === searchNameLower) {
            return true;
          }
          
          // Try exact match without emojis
          const cleanItemName = itemNameLower.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
          const cleanSearchName = searchNameLower.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
          
          if (cleanItemName === cleanSearchName) {
            return true;
          }
          
          // Try partial match without special characters
          const alphaNumItemName = cleanItemName.replace(/[^a-z0-9]/g, '');
          const alphaNumSearchName = cleanSearchName.replace(/[^a-z0-9]/g, '');
          
          return alphaNumItemName.includes(alphaNumSearchName) || alphaNumSearchName.includes(alphaNumItemName);
        });

      if (!itemEntry) {
        this.logger.debug('Item not found:', {
          searchName: itemName,
          cleanSearchName: itemName.toLowerCase().replace(/[^a-z0-9]/g, ''),
          availableItems: Object.entries(ITEMS).map(([_, item]) => ({
            name: item.name,
            cleanName: item.name.toLowerCase().replace(/[^a-z0-9]/g, '')
          }))
        });
        return message.reply(`❌ Item "${args[0]}" tidak ditemukan di shop!`);
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
            effect: JSON.stringify(item.effect || {}),
            stats: JSON.stringify(item.baseStats || {})
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

      // Add effect info based on item type
      if (item.effect) {
        try {
          const effect = getEffectData(item.effect);
          if (effect) {
            if (effect.type === 'HEAL') {
              const healValue = effect.health || 0;
              const healText = healValue < 0 ? '❤️ Memulihkan HP ke maksimum' : `❤️ Memulihkan ${healValue} HP`;
              embed.addFields({
                name: '💫 Efek',
                value: healText,
                inline: true
              });
            } else if (effect.stats) {
              const statsText = Object.entries(effect.stats)
                .map(([stat, value]) => `${stat === 'attack' ? '⚔️' : '🛡️'} ${stat.toUpperCase()}: ${formatStatValue(value)}`)
                .join('\n');
              
              embed.addFields({
                name: '📊 Stats',
                value: statsText,
                inline: true
              });
            }
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

  async handleSellCommand(message: Message, args: string[] | string) {
    try {
      // Ensure args is array
      const argArray = Array.isArray(args) ? args : args.split(' ');
      
      if (!argArray || argArray.length === 0) {
        return message.reply('❌ Format: `a sell [nama_item] [jumlah]`\nContoh: `a sell potion 5`');
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
        itemName = argArray.slice(0, -1).join(' ');
      } else {
        itemName = argArray.join(' ');
      }

      // Get user's inventory items first
      const inventoryItems = await this.prisma.inventory.findMany({
        where: { 
          characterId: character.id,
          quantity: { gte: 1 }
        },
        include: { item: true }
      });

      // Find matching item from inventory
      const inventoryItem = inventoryItems.find(inv => {
        const itemNameLower = inv.item.name.toLowerCase();
        const searchNameLower = itemName.toLowerCase();
        
        // Try exact match first
        if (itemNameLower === searchNameLower) {
          return true;
        }
        
        // Try match without emojis
        const cleanItemName = itemNameLower.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        const cleanSearchName = searchNameLower.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        
        if (cleanItemName === cleanSearchName) {
          return true;
        }
        
        // Try partial match
        return cleanItemName.includes(cleanSearchName) || cleanSearchName.includes(cleanItemName);
      });

      if (!inventoryItem) {
        return message.reply(`❌ Item "${itemName}" tidak ditemukan di inventory!`);
      }

      // Use inventory service to handle the sale
      return await this.inventoryService.handleSellItem(message, inventoryItem.itemId, quantity);

    } catch (error) {
      this.logger.error('Error in sell command:', error);
      return message.reply('❌ Terjadi kesalahan saat menjual item.');
    }
  }
} 