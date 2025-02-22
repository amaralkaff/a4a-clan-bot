import { PrismaClient } from '@prisma/client';
import { LOCATIONS } from '../src/config/gameData';
import { LocationId } from '../src/types/game';

const prisma = new PrismaClient();

const items = [
  // Healing Items - More powerful and affordable
  {
    id: 'potion',
    name: '🧪 Health Potion',
    description: 'Memulihkan 100 HP',
    type: 'CONSUMABLE',
    value: 30,
    effect: JSON.stringify({
      type: 'HEAL',
      value: 100
    })
  },
  {
    id: 'super_potion',
    name: '🔮 Super Potion',
    description: 'Memulihkan 200 HP',
    type: 'CONSUMABLE',
    value: 60,
    effect: JSON.stringify({
      type: 'HEAL',
      value: 200
    })
  },
  // Combat Buffs - Stronger effects
  {
    id: 'attack_buff',
    name: '⚔️ Attack Boost',
    description: 'Meningkatkan attack sebesar 15 selama pertarungan',
    type: 'CONSUMABLE',
    value: 50,
    effect: JSON.stringify({
      type: 'BUFF',
      stats: {
        attack: 15
      },
      duration: 3600 // 1 hour
    })
  },
  {
    id: 'defense_buff',
    name: '🛡️ Defense Boost',
    description: 'Meningkatkan defense sebesar 15 selama pertarungan',
    type: 'CONSUMABLE',
    value: 50,
    effect: JSON.stringify({
      type: 'BUFF',
      stats: {
        defense: 15
      },
      duration: 3600 // 1 hour
    })
  },
  // Crafting Materials - More value
  {
    id: 'meat_raw',
    name: '🥩 Daging Mentah',
    description: 'Daging segar yang belum dimasak',
    type: 'INGREDIENT',
    value: 20,
    effect: '{}'
  },
  {
    id: 'fish_fresh',
    name: '🐟 Ikan Segar',
    description: 'Ikan yang baru ditangkap',
    type: 'INGREDIENT',
    value: 25,
    effect: '{}'
  },
  {
    id: 'herbs',
    name: '🌿 Rempah-rempah',
    description: 'Bumbu untuk memasak',
    type: 'INGREDIENT',
    value: 15,
    effect: '{}'
  },
  // Food Items - Better healing and effects
  {
    id: 'meat_cooked',
    name: '🍖 Daging Panggang',
    description: 'Daging yang sudah dimasak dengan sempurna',
    type: 'FOOD',
    value: 40,
    effect: JSON.stringify({
      type: 'HEAL',
      value: 150,
      stats: {
        attack: 5,
        defense: 5
      },
      duration: 1800 // 30 minutes
    })
  },
  {
    id: 'sanji_special',
    name: '👨‍🍳 Hidangan Spesial Sanji',
    description: 'Masakan spesial yang memberikan buff attack dan defense',
    type: 'FOOD',
    value: 100,
    effect: JSON.stringify({
      type: 'BUFF',
      stats: {
        attack: 20,
        defense: 20
      },
      duration: 3600 // 1 hour
    })
  },
  // Combat Ration - All-in-one buff
  {
    id: 'combat_ration',
    name: '🎒 Combat Ration',
    description: 'Makanan praktis untuk pertarungan',
    type: 'FOOD',
    value: 75,
    effect: JSON.stringify({
      type: 'HEAL',
      value: 100,
      stats: {
        attack: 10,
        defense: 10
      },
      duration: 1800 // 30 minutes
    })
  },
  // Starter Equipment
  {
    id: 'starter_sword',
    name: '⚔️ Pedang Pemula+',
    description: 'Pedang dasar yang telah ditingkatkan',
    type: 'WEAPON',
    value: 100,
    effect: JSON.stringify({
      type: 'EQUIP',
      stats: {
        attack: 15
      }
    })
  },
  {
    id: 'starter_armor',
    name: '🛡️ Armor Pemula+',
    description: 'Armor dasar yang telah ditingkatkan',
    type: 'ARMOR',
    value: 100,
    effect: JSON.stringify({
      type: 'EQUIP',
      stats: {
        defense: 15
      }
    })
  }
];

// Starter items untuk karakter baru
const starterItems = [
  { itemId: 'potion', quantity: 5 },
  { itemId: 'attack_buff', quantity: 3 },
  { itemId: 'defense_buff', quantity: 3 },
  { itemId: 'combat_ration', quantity: 3 },
  { itemId: 'starter_sword', quantity: 1 },
  { itemId: 'starter_armor', quantity: 1 }
];

async function main() {
  console.log('Starting seeding...');

  // Seed locations
  for (const [id, location] of Object.entries(LOCATIONS)) {
    await prisma.location.upsert({
      where: { id },
      update: {
        name: location.name,
        description: location.description,
        level: location.level,
        weather: 'sunny',
        lastWeatherUpdate: new Date()
      },
      create: {
        id,
        name: location.name,
        description: location.description,
        level: location.level,
        weather: 'sunny',
        lastWeatherUpdate: new Date()
      }
    });
  }

  // Create items
  for (const item of items) {
    await prisma.item.upsert({
      where: { id: item.id },
      update: item,
      create: item
    });
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 