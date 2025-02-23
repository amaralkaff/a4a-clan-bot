// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { LOCATIONS, QUESTS, ITEMS } from '../src/config/gameData';
import { QuestType, ItemType, Rarity, QuestStatus } from '../src/types/game';

const prisma = new PrismaClient();

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

// Definisikan item templates
const itemTemplates: ItemTemplateData[] = [
  // Consumables
  {
    id: 'potion',
    name: '🧪 Health Potion',
    description: 'Memulihkan 50 HP',
    type: ItemType.CONSUMABLE,
    value: 50,
    effect: JSON.stringify({ 
      type: 'HEAL',
      health: 50 
    }),
    stackLimit: 99,
    rarity: Rarity.COMMON
  },
  {
    id: 'attack_buff',
    name: '⚔️ Attack Boost',
    description: 'ATK +5 selama pertarungan',
    type: ItemType.CONSUMABLE,
    value: 100,
    effect: JSON.stringify({ 
      type: 'BUFF',
      stats: { attack: 5 },
      duration: 3 
    }),
    stackLimit: 99,
    rarity: Rarity.RARE
  },
  {
    id: 'defense_buff',
    name: '🛡️ Defense Boost',
    description: 'DEF +5 selama pertarungan',
    type: ItemType.CONSUMABLE,
    value: 100,
    effect: JSON.stringify({ 
      type: 'BUFF',
      stats: { defense: 5 },
      duration: 3 
    }),
    stackLimit: 99,
    rarity: Rarity.RARE
  },
  {
    id: 'combat_ration',
    name: '🍖 Combat Ration',
    description: 'HP +100, ATK/DEF +3',
    type: ItemType.CONSUMABLE,
    value: 75,
    effect: JSON.stringify({ 
      type: 'HEAL_AND_BUFF',
      health: 100,
      stats: { attack: 3, defense: 3 },
      duration: 1800 
    }),
    stackLimit: 99,
    rarity: Rarity.COMMON
  },
  // Starter Equipment
  {
    id: 'starter_sword',
    name: '🗡️ Wooden Sword',
    description: 'Pedang kayu untuk pemula',
    type: ItemType.WEAPON,
    value: 50,
    effect: JSON.stringify({ 
      type: 'EQUIP',
      stats: { attack: 5 }
    }),
    maxDurability: 100,
    stackLimit: 1,
    rarity: Rarity.COMMON
  },
  {
    id: 'starter_armor',
    name: '🥋 Training Gi',
    description: 'Baju latihan dasar',
    type: ItemType.ARMOR,
    value: 50,
    effect: JSON.stringify({ 
      type: 'EQUIP',
      stats: { defense: 5 }
    }),
    maxDurability: 100,
    stackLimit: 1,
    rarity: Rarity.COMMON
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

async function main() {
  console.log('Starting seeding...');

  try {
    // Clean existing data dengan urutan yang benar
    console.log('Cleaning existing data...');
    
    // 1. Hapus inventory (bergantung pada character dan item)
    await prisma.inventory.deleteMany();
    
    // 2. Hapus quest (bergantung pada character)
    await prisma.quest.deleteMany();
    
    // 3. Hapus transaction (jika ada, bergantung pada character)
    await prisma.transaction?.deleteMany().catch(() => null);
    
    // 4. Hapus battle (jika ada, bergantung pada character)
    await prisma.battle?.deleteMany().catch(() => null);
    
    // 5. Hapus character (bergantung pada user dan location)
    await prisma.character.deleteMany();
    
    // 6. Hapus user
    await prisma.user.deleteMany();
    
    // 7. Hapus item
    await prisma.item.deleteMany();
    
    // 8. Hapus location
    await prisma.location.deleteMany();

    // Mulai seeding data baru
    console.log('Seeding locations...');
    for (const [id, location] of Object.entries(LOCATIONS)) {
      await prisma.location.create({
        data: {
          id,
          name: location.name,
          description: location.description,
          level: location.level,
          weather: 'sunny',
          lastWeatherUpdate: new Date()
        }
      });
    }

    // Create template user and character
    console.log('Creating template user and character...');
    const templateUser = await prisma.user.create({
      data: {
        id: 'template',
        discordId: 'template',
      }
    });

    const templateCharacter = await prisma.character.create({
      data: {
        id: 'template',
        name: 'Template Character',
        userId: templateUser.id,
        currentIsland: 'foosha',
        statusEffects: '{"effects":[]}',
        activeBuffs: '{"buffs":[]}',
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

    // Seed items
    console.log('Seeding items...');
    await prisma.item.createMany({
      data: itemTemplates
    });

    // Seed quest templates
    console.log('Seeding quest templates...');
    for (const template of questTemplates) {
      await prisma.quest.create({
        data: {
          id: template.id,
          templateId: template.id,
          name: template.name,
          description: template.description,
          type: template.type,
          objectives: template.objectives,
          rewards: template.rewards,
          progress: '{"current": 0, "required": 1}',
          status: QuestStatus.TEMPLATE,
          characterId: templateCharacter.id
        }
      });
    }

    console.log('Seeding completed successfully.');
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