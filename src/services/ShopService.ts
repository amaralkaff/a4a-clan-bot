import { PrismaClient } from '@prisma/client';
import { BaseService } from './BaseService';
import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChatInputCommandInteraction, APIEmbedField } from 'discord.js';
import { CharacterService } from './CharacterService';
import { InventoryService } from './InventoryService';
import { Cache } from '../utils/Cache';
import { createEphemeralReply } from '../utils/helpers';
import { 
  GameItem, 
  ITEMS, 
  RARITY_COLORS, 
  ITEM_TYPE_EMOJIS,
  Rarity 
} from '../config/gameData';
import {
  ItemType,
  Effect,
  EffectType,
  Stats,
  EffectData
} from '../types/game';
import {
  ItemStats,
  ItemEffect,
  DbItem,
  ShopItem,
  BuyResult,
  CachedShopItems,
  CachedDbItems,
  ShopItemTuple
} from '../types/shop';
import { EmbedFactory } from '../utils/embedBuilder';
import { DataCache } from './DataCache';
import { PaginationManager } from '../utils/pagination';
import { ErrorHandler, CharacterError, ShopError } from '../utils/errors';
import { logger } from '../utils/logger';
import { EquipmentService } from './EquipmentService';

const ITEMS_PER_PAGE = 10;

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

// Type guard for validating item tuple
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
  Object.entries(ITEMS).map(([id, item]) => [id, convertGameItemToShopItem(id, item)])
);

// Update scalePrice function to handle large numbers
function scalePrice(price: number): number {
  // For prices above 1B, scale 1:1000
  if (price >= 1000000000) { // 1 Billion+
    return Math.floor(price / 1000);
  }
  // For prices 1M - 1B, scale 1:100
  else if (price >= 1000000) { // 1 Million+
    return Math.floor(price / 100);
  }
  return price;
}

// Helper function to validate and convert effect data
function validateAndConvertEffect(effect: any): Effect {
  if (!effect) return { type: 'EQUIP' as EffectType, stats: {} };
  
  // If effect is already a string, return it
  if (typeof effect === 'string') return effect;
  
  try {
    // Handle different effect types
    if (effect.type === 'HEAL') {
      return {
        type: 'HEAL' as EffectType,
        health: effect.health || 0
      };
    } else if (effect.type === 'BUFF') {
      return {
        type: 'BUFF' as EffectType,
        stats: effect.stats || {},
        duration: effect.duration || 0
      };
    } else if (effect.type === 'HEAL_AND_BUFF') {
      return {
        type: 'HEAL_AND_BUFF' as EffectType,
        health: effect.health || 0,
        stats: effect.stats || {},
        duration: effect.duration || 0
      };
    } else if (effect.type === 'EQUIP') {
      return {
        type: 'EQUIP' as EffectType,
        stats: effect.stats || {}
      };
    }
    
    return { type: 'EQUIP' as EffectType, stats: {} };
  } catch (error) {
    return { type: 'EQUIP' as EffectType, stats: {} };
  }
}

// Helper function to validate rarity
function validateRarity(rarity: string): Rarity {
  const validRarities: Rarity[] = [
    'COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY',
    'MYTHICAL', 'DIVINE', 'TRANSCENDENT', 'CELESTIAL',
    'PRIMORDIAL', 'ULTIMATE'
  ];
  
  const upperRarity = rarity.toUpperCase() as Rarity;
  return validRarities.includes(upperRarity) ? upperRarity : 'COMMON';
}

interface ShopCategory {
  type: ItemType;
  items: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    rarity: string;
    effect: any;
  }>;
}

export class ShopService extends BaseService {
  private characterService: CharacterService;
  private inventoryService: InventoryService;
  private equipmentService: EquipmentService | null = null;
  private shopItemsCache: Cache<CachedShopItems>;
  private dbItemsCache: Cache<CachedDbItems>;
  private readonly SHOP_ITEMS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly DB_ITEMS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly dataCache: DataCache;
  private readonly shopCache: Cache<Record<string, GameItem>>;
  private readonly ITEMS_PER_PAGE = 2; // Number of item categories per page

  constructor(
    prisma: PrismaClient,
    characterService: CharacterService,
    inventoryService: InventoryService
  ) {
    super(prisma);
    this.characterService = characterService;
    this.inventoryService = inventoryService;
    this.shopItemsCache = new Cache<CachedShopItems>();
    this.dbItemsCache = new Cache<CachedDbItems>(this.DB_ITEMS_CACHE_TTL);
    this.dataCache = DataCache.getInstance();
    this.shopCache = new Cache<Record<string, GameItem>>(this.SHOP_ITEMS_CACHE_TTL);

    // Set up periodic cache cleanup
    setInterval(() => {
      this.shopItemsCache.cleanup();
      this.dbItemsCache.cleanup();
      this.shopCache.cleanup();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  setEquipmentService(service: EquipmentService) {
    this.equipmentService = service;
  }

  private getShopItemsCacheKey(): string {
    return 'shop_items';
  }

  private getDbItemsCacheKey(): string {
    return 'db_items';
  }

  private getShopCacheKey(): string {
    return 'shop_items';
  }

  private async getShopItems(): Promise<Record<string, GameItem>> {
    const cacheKey = this.getShopCacheKey();
    const cachedItems = this.shopCache.get(cacheKey);
    if (cachedItems) {
      return cachedItems;
    }

    const items = this.dataCache.getItems();
    this.shopCache.set(cacheKey, items);
    return items;
  }

  private async getDbItems(): Promise<DbItem[]> {
    // Check cache first
    const cacheKey = this.getDbItemsCacheKey();
    const cachedItems = this.dbItemsCache.get(cacheKey);
    if (cachedItems) {
      return cachedItems.items;
    }

    // Get items from database
    const dbItems = await this.prisma.item.findMany();

    // Convert types to match DbItem interface
    const convertedItems: DbItem[] = dbItems.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type as ItemType,
      description: item.description,
      value: Number(item.value),
      effect: item.effect,
      maxDurability: item.maxDurability,
      stackLimit: item.stackLimit,
      rarity: item.rarity as Rarity,
      baseStats: item.baseStats,
      upgradeStats: item.upgradeStats,
      maxLevel: item.maxLevel
    }));

    // Cache the items
    this.dbItemsCache.set(cacheKey, {
      items: convertedItems,
      lastUpdated: Date.now()
    });

    return convertedItems;
  }

  private async createShopEmbed(userId: string) {
    const character = await this.characterService.getCharacterByDiscordId(userId);
      
      if (!character) {
      throw new Error('❌ Kamu harus membuat karakter terlebih dahulu dengan `/start`');
      }

      const balance = await this.characterService.getBalance(character.id);

    // Group items by type and rarity
    const groupedItems: Record<string, Record<string, ShopItem[]>> = {};
    const items = this.dataCache.getItems();
    
    Object.entries(items).forEach(([id, item]) => {
      if (!groupedItems[item.type]) {
        groupedItems[item.type] = {};
      }
      if (!groupedItems[item.type][item.rarity]) {
        groupedItems[item.type][item.rarity] = [];
      }
      groupedItems[item.type][item.rarity].push({
        id,
        name: item.name,
        description: item.description,
        type: item.type,
        price: item.price,
        effect: item.effect,
        baseStats: JSON.stringify(item.baseStats || {}),
        upgradeStats: JSON.stringify(item.upgradeStats || {}),
        maxDurability: item.maxDurability || null,
        stackLimit: item.stackLimit,
        rarity: item.rarity,
        maxLevel: item.maxLevel || null
      });
    });

    return EmbedFactory.buildShopEmbed(balance.coins, groupedItems);
  }

  async handleShopInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const embed = await this.createShopEmbed(interaction.user.id);
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply(createEphemeralReply({
        content: error instanceof Error ? error.message : '❌ An error occurred'
      }));
    }
  }

  async handleShopMessage(message: Message): Promise<void> {
    try {
      const embed = await this.createShopEmbed(message.author.id);
      await message.reply({ embeds: [embed] });
          } catch (error) {
      await message.reply(error instanceof Error ? error.message : '❌ An error occurred');
    }
  }

  async handleShop(source: Message | ChatInputCommandInteraction): Promise<void> {
    try {
      const userId = source instanceof Message ? source.author.id : source.user.id;
      const character = await this.characterService.getCharacterByDiscordId(userId);
      
      if (!character) {
        throw new Error('❌ Kamu harus membuat karakter terlebih dahulu dengan `a start`');
      }

      const balance = await this.characterService.getBalance(character.id);
      const categories = await this.getShopCategories();

      await PaginationManager.paginate(source, {
        items: categories,
        itemsPerPage: this.ITEMS_PER_PAGE,
        embedBuilder: async (categories, currentPage, totalPages) => {
          const embed = new EmbedBuilder()
            .setTitle('🛍️ A4A CLAN Shop')
            .setDescription(`💰 Uangmu: ${balance.coins} coins\nGunakan \`a buy <item>\` untuk membeli item.`)
            .setColor('#ffd700');

          categories.forEach(category => {
            const itemList = category.items
              .map(item => {
                const effectDesc = this.formatEffectDescription(item.effect);
                let text = `${ITEM_TYPE_EMOJIS[category.type]} ${item.name}\n`;
                text += `💰 ${item.price.toLocaleString()} coins\n`;
                text += `📝 ${item.description}\n`;
                if (effectDesc) text += `${effectDesc}\n`;
                return text;
              })
              .join('\n');

            embed.addFields({
              name: `${ITEM_TYPE_EMOJIS[category.type]} ${category.type}`,
              value: itemList || 'Tidak ada item',
              inline: false
            });
          });

          if (totalPages > 1) {
            embed.setFooter({ text: `Halaman ${currentPage}/${totalPages} • Gunakan a buy <item> untuk membeli` });
          }

          return embed;
        },
        ephemeral: source instanceof ChatInputCommandInteraction
      });
    } catch (error) {
      await ErrorHandler.handle(error, source);
    }
  }

  private async processPurchase(characterId: string, itemId: string, quantity: number, item: GameItem): Promise<BuyResult> {
    try {
      // Calculate total cost
      const totalCost = item.price * quantity;

      // Get character's current balance
      const balance = await this.characterService.getBalance(characterId);

      // Check if character has enough coins
      if (balance.coins < totalCost) {
        return {
          success: false,
          message: `❌ Uang tidak cukup! Kamu butuh ${totalCost} coins untuk membeli ${quantity}x ${item.name}.`
        };
      }

      // Check stack limit
      const currentInventory = await this.inventoryService.getInventory(characterId);
      const existingItem = currentInventory.find(i => i.id === itemId);
      
      if (existingItem && existingItem.quantity + quantity > item.stackLimit) {
        return {
          success: false,
          message: `❌ Tidak bisa membeli lebih banyak, stack limit tercapai!`
        };
      }

      // Process the purchase
      await this.characterService.removeCoins(
        characterId, 
        totalCost,
        'SHOP_PURCHASE',
        `Bought ${quantity}x ${item.name}`
      );

      // Add items to inventory
      await this.inventoryService.addItems(characterId, itemId, quantity);

      return {
        success: true,
        message: `✅ Berhasil membeli ${quantity}x ${item.name} seharga ${scalePrice(totalCost)} coins!`
      };
    } catch (error) {
      this.logger.error('Error in processPurchase:', error);
      return {
        success: false,
        message: '❌ Terjadi kesalahan saat memproses pembelian.'
      };
    }
  }

  async handleBuyCommand(message: Message, args: string[] | string): Promise<void> {
    try {
      const argArray = Array.isArray(args) ? args : args.split(/\s+/);
      
      if (!argArray || argArray.length === 0) {
        throw ShopError.invalidFormat();
      }

      const character = await this.characterService.getCharacterByDiscordId(message.author.id);
      if (!character) {
        throw CharacterError.notFound(message.author.id);
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

      // Find item in both ITEMS and database
      const itemResult = await this.findItemByName(itemName);
      if (!itemResult) {
        throw ShopError.itemNotFound(itemName);
      }

      const [itemId, item] = itemResult;

      // Check stack limit
      const currentInventory = await this.inventoryService.getInventory(character.id);
      const existingItem = currentInventory.find(i => i.id === itemId);
      
      if (existingItem && existingItem.quantity + quantity > item.stackLimit) {
        throw ShopError.stackLimitReached(itemId, item.name, existingItem.quantity, item.stackLimit);
      }

      // Process the purchase
      await this.handleBuyItem(message, itemId, quantity);
    } catch (error) {
      await ErrorHandler.handle(error, message);
    }
  }

  async handleSellCommand(message: Message, args: string[] | string) {
    // TODO: Implement sell command
    return message.reply('❌ Fitur ini belum tersedia.');
  }

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

      // Try to find item by ID first
      let item = ITEMS[itemId];
      
      // If not found by ID, try to find by name
      if (!item) {
        const itemResult = await this.findItemByName(itemId);
        if (!itemResult) {
          return {
            success: false,
            message: `❌ Item "${itemId}" tidak ditemukan di shop!`
          };
        }
        [itemId, item] = itemResult;
      }

      // Process the purchase
      const result = await this.processPurchase(character.id, itemId, 1, item);
      return result;

    } catch (error) {
      this.logger.error('Error in buyItemSlash:', error);
      return {
        success: false,
        message: '❌ Terjadi kesalahan saat membeli item.'
      };
    }
  }

  private async findItemByName(name: string): Promise<[string, GameItem] | null> {
    const items = this.dataCache.getItems();
    const normalizedName = name.toLowerCase();
      
      // Try exact match first
    for (const [id, item] of Object.entries(items)) {
      if (item.name.toLowerCase() === normalizedName) {
        return [id, item];
      }
    }

    // Try partial match
    for (const [id, item] of Object.entries(items)) {
      if (item.name.toLowerCase().includes(normalizedName)) {
        return [id, item];
      }
    }

    return null;
  }

  private formatEffectDescription(effect: any): string {
    if (!effect) return '';

    let description = '';
    if (effect.type === 'HEAL') {
      description = `❤️ Heal ${effect.health} HP`;
    } else if (effect.stats) {
      const stats = Object.entries(effect.stats)
        .map(([stat, value]) => {
          const statValue = value as number;
          return `${stat === 'attack' ? '⚔️' : stat === 'defense' ? '🛡️' : '💨'} ${stat.toUpperCase()}: ${statValue > 0 ? '+' : ''}${statValue}`;
        })
        .join('\n');
      description = stats;
      if (effect.duration) {
        description += `\n⏳ Duration: ${effect.duration / 60} minutes`;
      }
    }
    return description;
  }

  private async getShopCategories(): Promise<ShopCategory[]> {
    const items = await this.getShopItems();
    const categories: Record<ItemType, ShopCategory> = {} as Record<ItemType, ShopCategory>;

    // Group items by type
    Object.entries(items).forEach(([id, item]) => {
      if (!categories[item.type]) {
        categories[item.type] = {
          type: item.type,
          items: []
        };
      }

      categories[item.type].items.push({
        id,
        name: item.name,
        description: item.description,
        price: item.price,
        rarity: item.rarity,
        effect: item.effect
      });
    });

    // Sort categories by type
    const typeOrder: ItemType[] = ['WEAPON', 'ARMOR', 'ACCESSORY', 'CONSUMABLE', 'MATERIAL'];
    return Object.values(categories).sort((a, b) => 
      typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type)
    );
  }

  async handleBuyItem(source: Message | ChatInputCommandInteraction, itemId: string, quantity: number = 1): Promise<void> {
    try {
      const userId = source instanceof Message ? source.author.id : source.user.id;
      const character = await this.characterService.getCharacterByDiscordId(userId);
      
      if (!character) {
        throw CharacterError.notFound(userId);
      }

      // Get item from shop
      const items = await this.getShopItems();
      const item = items[itemId];
      if (!item) {
        throw ShopError.itemNotFound(itemId);
      }

      // Check if quantity is valid
      if (quantity < 1) {
        throw ShopError.invalidQuantity(quantity);
      }

      // Check if player has enough coins
      const totalCost = item.price * quantity;
      const balance = await this.characterService.getBalance(character.id);
      if (balance.coins < totalCost) {
        throw ShopError.insufficientFunds(item.name, quantity, totalCost, balance.coins);
      }

      // Check stack limit
      const inventory = await this.inventoryService.getInventory(character.id);
      const existingItem = inventory.find(i => i.id === itemId);
      if (existingItem && existingItem.quantity + quantity > item.stackLimit) {
        throw ShopError.stackLimitReached(itemId, item.name, existingItem.quantity, item.stackLimit);
      }

      // Process purchase in transaction
      await this.prisma.$transaction(async (tx) => {
        // Remove coins
        await tx.character.update({
          where: { id: character.id },
          data: { coins: { decrement: totalCost } }
        });

        // Add item to inventory
        await this.inventoryService.addItems(character.id, itemId, quantity);

        // Create transaction record
        await tx.transaction.create({
          data: {
            characterId: character.id,
            type: 'SHOP_PURCHASE',
            amount: -totalCost,
            description: `Bought ${quantity}x ${item.name}`
          }
        });
      });

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle('✅ Purchase Successful!')
        .setDescription(`Berhasil membeli ${quantity}x ${item.name} seharga ${totalCost} coins!`)
        .setColor('#00ff00');

      // Add effect info if applicable
      const effectDesc = this.formatEffectDescription(item.effect);
      if (effectDesc) {
        embed.addFields({ name: '💫 Effect', value: effectDesc });
      }

      await source.reply({ embeds: [embed], ephemeral: source instanceof ChatInputCommandInteraction });
    } catch (error) {
      await ErrorHandler.handle(error, source);
    }
  }
} 