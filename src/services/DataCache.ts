import { Cache } from '../utils/Cache';
import { GameItem, JsonMonster, Quest, WeaponUpgradeData, MaterialData, ItemType, Rarity } from '../config/gameData';
import gameDataJson from '../config/gameData.json';
import weaponDataJson from '../config/weaponData.json';
import armorDataJson from '../config/armorData.json';
import accessoryDataJson from '../config/accessoryData.json';
import consumableDataJson from '../config/consumableData.json';
import monsterDataJson from '../config/monsterData.json';

// Helper function to convert raw item data to GameItem
function convertToGameItem(data: any): GameItem {
  // Ensure price is a valid number
  const price = typeof data.price === 'string' ? parseInt(data.price, 10) :
                typeof data.price === 'number' ? data.price :
                typeof data.value === 'number' ? data.value : 0;

  return {
    name: data.name,
    type: data.type as ItemType,
    description: data.description,
    price: price,
    effect: data.effect || {},
    baseStats: data.baseStats || {},
    upgradeStats: data.upgradeStats || {},
    maxLevel: data.maxLevel || null,
    rarity: data.rarity as Rarity || 'COMMON',
    stackLimit: data.stackLimit || 999,
    maxDurability: data.maxDurability || null
  };
}

// Helper function to convert raw monster data to JsonMonster
function convertToJsonMonster(data: any): JsonMonster {
  return {
    name: data.name,
    level: data.level,
    health: data.health || data.hp,
    attack: data.attack,
    defense: data.defense,
    exp: data.exp,
    coins: data.coins || Math.floor(data.exp * 0.5), // Default coins if not specified
    drops: data.drops || [],
    description: data.description || '',
    location: data.location || []
  };
}

export class DataCache {
  private static instance: DataCache;
  private itemCache: Cache<Record<string, GameItem>>;
  private monsterCache: Cache<Record<string, JsonMonster>>;
  private questCache: Cache<Record<string, Quest>>;
  private weaponUpgradeCache: Cache<Record<string, WeaponUpgradeData>>;
  private materialCache: Cache<Record<string, MaterialData>>;

  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.itemCache = new Cache<Record<string, GameItem>>(this.CACHE_TTL);
    this.monsterCache = new Cache<Record<string, JsonMonster>>(this.CACHE_TTL);
    this.questCache = new Cache<Record<string, Quest>>(this.CACHE_TTL);
    this.weaponUpgradeCache = new Cache<Record<string, WeaponUpgradeData>>(this.CACHE_TTL);
    this.materialCache = new Cache<Record<string, MaterialData>>(this.CACHE_TTL);

    // Set up periodic cache cleanup
    setInterval(() => this.cleanupCaches(), this.CACHE_TTL);
  }

  public static getInstance(): DataCache {
    if (!DataCache.instance) {
      DataCache.instance = new DataCache();
    }
    return DataCache.instance;
  }

  private cleanupCaches(): void {
    this.itemCache.cleanup();
    this.monsterCache.cleanup();
    this.questCache.cleanup();
    this.weaponUpgradeCache.cleanup();
    this.materialCache.cleanup();
  }

  public getItems(): Record<string, GameItem> {
    const cacheKey = 'items';
    let items = this.itemCache.get(cacheKey);

    if (!items) {
      // Convert and merge all item types
      const allItems: Record<string, GameItem> = {};
      
      // Process each item source
      [
        weaponDataJson,
        armorDataJson,
        accessoryDataJson,
        consumableDataJson
      ].forEach((source) => {
        Object.entries(source).forEach(([id, itemData]) => {
          try {
            allItems[id] = convertToGameItem(itemData);
          } catch (error) {
            console.error(`Error converting item ${id}:`, error);
          }
        });
      });

      items = allItems;
      this.itemCache.set(cacheKey, items);
    }

    return items;
  }

  public getMonsters(): Record<string, JsonMonster> {
    const cacheKey = 'monsters';
    let monsters = this.monsterCache.get(cacheKey);

    if (!monsters) {
      const rawMonsters = monsterDataJson.MONSTERS || {};
      const convertedMonsters: Record<string, JsonMonster> = {};
      
      Object.entries(rawMonsters).forEach(([id, monster]) => {
        convertedMonsters[id] = convertToJsonMonster(monster);
      });

      monsters = convertedMonsters;
      this.monsterCache.set(cacheKey, monsters);
    }

    return monsters;
  }

  public getQuests(): Record<string, Quest> {
    const cacheKey = 'quests';
    let quests = this.questCache.get(cacheKey);

    if (!quests) {
      const rawQuests = gameDataJson.QUESTS || {};
      const convertedQuests: Record<string, Quest> = {};
      
      Object.entries(rawQuests).forEach(([id, quest]: [string, any]) => {
        convertedQuests[id] = {
          ...quest,
          id,
          isDaily: quest.isDaily || false
        };
      });

      quests = convertedQuests;
      this.questCache.set(cacheKey, quests);
    }

    return quests;
  }

  public getWeaponUpgrades(): Record<string, WeaponUpgradeData> {
    const cacheKey = 'weapon_upgrades';
    let upgrades = this.weaponUpgradeCache.get(cacheKey);

    if (!upgrades) {
      upgrades = {}; // Feature not implemented yet
      this.weaponUpgradeCache.set(cacheKey, upgrades);
    }

    return upgrades;
  }

  public getMaterials(): Record<string, MaterialData> {
    const cacheKey = 'materials';
    let materials = this.materialCache.get(cacheKey);

    if (!materials) {
      materials = {}; // Feature not implemented yet
      this.materialCache.set(cacheKey, materials);
    }

    return materials;
  }

  public invalidateCache(type: 'items' | 'monsters' | 'quests' | 'weapon_upgrades' | 'materials'): void {
    switch (type) {
      case 'items':
        this.itemCache.clear();
        break;
      case 'monsters':
        this.monsterCache.clear();
        break;
      case 'quests':
        this.questCache.clear();
        break;
      case 'weapon_upgrades':
        this.weaponUpgradeCache.clear();
        break;
      case 'materials':
        this.materialCache.clear();
        break;
    }
  }

  public invalidateAllCaches(): void {
    this.itemCache.clear();
    this.monsterCache.clear();
    this.questCache.clear();
    this.weaponUpgradeCache.clear();
    this.materialCache.clear();
  }
} 