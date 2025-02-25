// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { 
  ITEMS, 
  LOCATIONS, 
  WEAPON_UPGRADES, 
  MATERIALS,
  MaterialData
} from '../src/config/gameData';
import { QuestType, ItemType, Rarity, QuestStatus } from '../src/types/game';

const prisma = new PrismaClient();

// Add starter items to inventory
const starterItems = [
  { 
    itemId: 'wooden_sword', 
    quantity: 1,
    durability: 100,
    maxDurability: 100,
    stats: JSON.stringify({
      attack: 5,
      defense: 0
    }),
    effect: JSON.stringify({
      type: 'EQUIP',
      stats: { attack: 5 }
    }),
    level: 1,
    upgrades: 0
  },
  { 
    itemId: 'training_gi', 
    quantity: 1,
    durability: 100,
    maxDurability: 100,
    stats: JSON.stringify({
      attack: 0,
      defense: 5
    }),
    effect: JSON.stringify({
      type: 'EQUIP',
      stats: { defense: 5 }
    }),
    level: 1,
    upgrades: 0
  },
  { 
    itemId: 'potion', 
    quantity: 5,
    effect: JSON.stringify({
      type: 'HEAL',
      health: 50
    }),
    stats: JSON.stringify({}),
    durability: null,
    maxDurability: null,
    level: 1,
    upgrades: 0
  }
];

// Definisikan tipe untuk quest template
interface QuestTemplateData {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  requirements: {
    level: number;
    mentor?: string;
  };
  objectives: string;
  rewards: string;
  isRepeatable: boolean;
  cooldown?: number;
}

// Definisikan tipe untuk item template
interface ItemTemplateData {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  value: number;
  effect: string;
  maxDurability?: number;
  stackLimit: number;
  rarity: Rarity;
}

// Seed items
const itemTemplates = [
  // Weapons - Common
  {
    id: 'wooden_sword',
    name: '🗡️ Wooden Sword',
    type: 'WEAPON',
    description: '⚔️ Pedang kayu untuk pemula',
    value: 100,
    effect: JSON.stringify({
      type: 'EQUIP',
      stats: { attack: 5 }
    }),
    baseStats: JSON.stringify({
      attack: 5,
      defense: 0
    }),
    upgradeStats: JSON.stringify({
      attack: 2,
      defense: 1
    }),
    maxDurability: 100,
    maxLevel: 5,
    rarity: 'COMMON'
  },
  // Armor - Common
  {
    id: 'training_gi',
    name: '🥋 Training Gi',
    type: 'ARMOR',
    description: '🛡️ Baju latihan dasar',
    value: 100,
    effect: JSON.stringify({
      type: 'EQUIP',
      stats: { defense: 5 }
    }),
    baseStats: JSON.stringify({
      attack: 0,
      defense: 5
    }),
    upgradeStats: JSON.stringify({
      attack: 0,
      defense: 2
    }),
    maxDurability: 100,
    maxLevel: 5,
    rarity: 'COMMON'
  },
  // Consumables
  {
    id: 'potion',
    name: '🧪 Health Potion',
    type: 'CONSUMABLE',
    description: '❤️ Memulihkan 50 HP',
    value: 50,
    effect: JSON.stringify({ 
      type: 'HEAL',
      value: 50 
    }),
    rarity: 'COMMON'
  },
  {
    id: 'attack_boost',
    name: '⚔️ Attack Boost',
    type: 'CONSUMABLE',
    description: '💪 ATK +10 selama 30 menit',
    value: 200,
    effect: JSON.stringify({ 
      type: 'BUFF',
      stats: { attack: 10 },
      duration: 1800 
    }),
    rarity: 'UNCOMMON'
  },
  {
    id: 'defense_boost',
    name: '🛡️ Defense Boost',
    type: 'CONSUMABLE',
    description: '🛡️ DEF +10 selama 30 menit',
    value: 200,
    effect: JSON.stringify({ 
      type: 'BUFF',
      stats: { defense: 10 },
      duration: 1800 
    }),
    rarity: 'UNCOMMON'
  },
  {
    id: 'combat_ration',
    name: '🍖 Combat Ration',
    type: 'CONSUMABLE',
    description: '❤️ HP +100, ATK/DEF +5 selama 1 jam',
    value: 500,
    effect: JSON.stringify({ 
      type: 'HEAL_AND_BUFF',
      health: 100,
      stats: { attack: 5, defense: 5 },
      duration: 3600 
    }),
    rarity: 'RARE'
  }
];

// Definisikan quest templates
const questTemplates: QuestTemplateData[] = [
  // Tutorial Quests
  {
    id: 'tutorial_hunt',
    name: '🗡️ Latihan Berburu',
    description: 'Kalahkan 3 monster di Foosha Village',
    type: QuestType.COMBAT,
    requirements: { level: 1 },
    objectives: JSON.stringify({
      type: QuestType.COMBAT,
      required: 3,
      current: 0
    }),
    rewards: JSON.stringify({
      exp: 100,
      coins: 50,
      items: ['potion']
    }),
    isRepeatable: false,
    cooldown: undefined
  },
  // Daily Quests
  {
    id: 'daily_hunt',
    name: '🎯 Berburu Harian',
    description: 'Kalahkan 5 monster hari ini',
    type: QuestType.DAILY,
    requirements: { level: 1 },
    objectives: JSON.stringify({
      type: QuestType.COMBAT,
      required: 5,
      current: 0
    }),
    rewards: JSON.stringify({
      exp: 200,
      coins: 100,
      items: ['combat_ration']
    }),
    isRepeatable: true,
    cooldown: 86400
  },
  // Mentor Quests
  {
    id: 'luffy_combo',
    name: '⚡ Combo Master',
    description: 'Capai combo 5x dalam pertarungan',
    type: QuestType.COMBO,
    requirements: { 
      level: 5,
      mentor: 'YB'
    },
    objectives: JSON.stringify({
      type: QuestType.COMBO,
      required: 5,
      current: 0
    }),
    rewards: JSON.stringify({
      exp: 300,
      coins: 150,
      items: ['attack_buff']
    }),
    isRepeatable: false,
    cooldown: undefined
  },
  {
    id: 'zoro_crit',
    name: '🗡️ Critical Strike',
    description: 'Lakukan 5 critical hit',
    type: QuestType.CRITICAL_HIT,
    requirements: {
      level: 5,
      mentor: 'Tierison'
    },
    objectives: JSON.stringify({
      type: QuestType.CRITICAL_HIT,
      required: 5,
      current: 0
    }),
    rewards: JSON.stringify({
      exp: 300,
      coins: 150,
      items: ['defense_buff']
    }),
    isRepeatable: false,
    cooldown: undefined
  }
];

// Fungsi untuk memproses dan menyimpan data game
async function seedGameData() {
  console.log('Starting game data seeding...');

  try {
    // Seed locations first
    console.log('Seeding locations...');
    for (const [locationId, locationData] of Object.entries(LOCATIONS)) {
      console.log('Processing location:', locationId, locationData);
      const existingLocation = await prisma.location.findUnique({
        where: { id: locationId }
      });

      if (!existingLocation) {
        await prisma.location.create({
          data: {
            id: locationId,
            name: locationData.name,
            description: locationData.description,
            level: locationData.level,
            weather: 'sunny',
            lastWeatherUpdate: new Date()
          }
        });
        console.log(`Created location: ${locationData.name}`);
      }
    }

    // Then seed items
    console.log('Seeding items...');
    for (const [itemId, itemData] of Object.entries(ITEMS)) {
      console.log('Processing item:', itemId, itemData);
      const existingItem = await prisma.item.findUnique({
        where: { id: itemId }
      });

      if (!existingItem) {
        await prisma.item.create({
          data: {
            id: itemId,
            name: itemData.name,
            description: itemData.description,
            type: itemData.type,
            value: itemData.price,
            effect: JSON.stringify(itemData.effect || {}),
            baseStats: JSON.stringify(itemData.baseStats || {}),
            upgradeStats: JSON.stringify(itemData.upgradeStats || {}),
            maxDurability: itemData.maxDurability,
            stackLimit: itemData.stackLimit || 999,
            rarity: itemData.rarity,
            maxLevel: itemData.maxLevel || 1
          }
        });
        console.log(`Created item: ${itemData.name}`);
      }
    }

    // Then seed weapon upgrades
    console.log('Seeding weapon upgrades...');
    for (const [weaponId, weaponData] of Object.entries(WEAPON_UPGRADES)) {
      console.log('Processing weapon upgrade:', weaponId, weaponData);
      // Weapon upgrade data will be used in the upgrade system
      console.log(`Added weapon upgrade config: ${weaponData.name}`);
    }

    // Then seed materials
    console.log('Seeding materials...');
    for (const [materialId, materialData] of Object.entries(MATERIALS) as [string, MaterialData][]) {
      console.log('Processing material:', materialId, materialData);
      const existingMaterial = await prisma.item.findUnique({
        where: { id: materialId }
      });

      if (!existingMaterial) {
        await prisma.item.create({
          data: {
            id: materialId,
            name: materialData.name,
            description: materialData.description,
            type: 'MATERIAL',
            value: 0, // Materials don't have direct value
            rarity: materialData.rarity,
            stackLimit: materialData.stackLimit,
            effect: '{}',
            baseStats: '{}',
            upgradeStats: '{}'
          }
        });
        console.log(`Created material: ${materialData.name}`);
      }
    }

    // Finally create template character if no users exist
    const userCount = await prisma.user.count();
    
    if (userCount === 0) {
      console.log('No users found, creating template user and character...');
      
      await prisma.$transaction(async (tx) => {
        // Check if starter_island exists
        const starterIsland = await tx.location.findUnique({
          where: { id: 'starter_island' }
        });

        if (!starterIsland) {
          throw new Error('Starter island not found! Make sure locations are seeded first.');
        }

        // Create user
        const user = await tx.user.create({
          data: {
            id: 'template',
            discordId: 'template'
          }
        });
        console.log('Created template user');

        // Create character
        const character = await tx.character.create({
          data: {
            id: 'template',
            name: 'Template Character',
            userId: user.id,
            currentIsland: 'starter_island',
            statusEffects: JSON.stringify({ effects: [] }),
            activeBuffs: JSON.stringify({ buffs: [] }),
            level: 1,
            experience: 0,
            health: 100,
            maxHealth: 100,
            attack: 10,
            defense: 10,
            coins: 0,
            bank: 0,
            combo: 0,
            questPoints: 0,
            explorationPoints: 0,
            wins: 0,
            losses: 0,
            winStreak: 0,
            highestStreak: 0,
            totalGambled: 0,
            totalWon: 0
          }
        });
        console.log('Created template character');

        // Add starter items
        console.log('Adding starter items...');
        for (const item of starterItems) {
          // Verify item exists in database
          const itemExists = await tx.item.findUnique({
            where: { id: item.itemId }
          });

          if (!itemExists) {
            console.log(`Creating item ${item.itemId} in database first...`);
            await tx.item.create({
              data: {
                id: item.itemId,
                name: ITEMS[item.itemId].name,
                description: ITEMS[item.itemId].description,
                type: ITEMS[item.itemId].type,
                value: ITEMS[item.itemId].price,
                effect: JSON.stringify(ITEMS[item.itemId].effect || {}),
                baseStats: JSON.stringify(ITEMS[item.itemId].baseStats || {}),
                upgradeStats: JSON.stringify(ITEMS[item.itemId].upgradeStats || {}),
                maxDurability: ITEMS[item.itemId].maxDurability,
                stackLimit: ITEMS[item.itemId].stackLimit || 999,
                rarity: ITEMS[item.itemId].rarity,
                maxLevel: ITEMS[item.itemId].maxLevel || 1
              }
            });
          }

          // Now add to inventory
          await tx.inventory.create({
            data: {
              characterId: character.id,
              ...item
            }
          });
          console.log(`Added ${item.itemId} to inventory`);
        }
      });
    }

    console.log('Game data seeding completed successfully.');
  } catch (error) {
    console.error('Error during game data seeding:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedGameData();
  } catch (error) {
    console.error('Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });