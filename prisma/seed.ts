import { PrismaClient } from '@prisma/client';
import { LOCATIONS } from '../src/config/gameData';
import { LocationId } from '../src/types/game';

const prisma = new PrismaClient();

const items = [
  {
    id: 'potion',
    name: '🧪 Health Potion',
    description: 'Memulihkan 50 HP',
    type: 'CONSUMABLE',
    value: 50,
    effect: JSON.stringify({
      type: 'HEAL',
      value: 50
    })
  },
  {
    id: 'super_potion',
    name: '🔮 Super Potion',
    description: 'Memulihkan 100 HP',
    type: 'CONSUMABLE',
    value: 100,
    effect: JSON.stringify({
      type: 'HEAL',
      value: 100
    })
  },
  {
    id: 'attack_buff',
    name: '⚔️ Attack Boost',
    description: 'Meningkatkan attack sebesar 5 selama pertarungan',
    type: 'CONSUMABLE',
    value: 75,
    effect: JSON.stringify({
      type: 'BUFF',
      stats: {
        attack: 5
      },
      duration: 3600 // 1 hour
    })
  },
  {
    id: 'defense_buff',
    name: '🛡️ Defense Boost',
    description: 'Meningkatkan defense sebesar 5 selama pertarungan',
    type: 'CONSUMABLE',
    value: 75,
    effect: JSON.stringify({
      type: 'BUFF',
      stats: {
        defense: 5
      },
      duration: 3600 // 1 hour
    })
  },
  {
    id: 'meat_raw',
    name: '🥩 Daging Mentah',
    description: 'Daging segar yang belum dimasak',
    type: 'INGREDIENT',
    value: 10,
    effect: '{}'
  },
  {
    id: 'fish_fresh',
    name: '🐟 Ikan Segar',
    description: 'Ikan yang baru ditangkap',
    type: 'INGREDIENT',
    value: 15,
    effect: '{}'
  },
  {
    id: 'herbs',
    name: '🌿 Rempah-rempah',
    description: 'Bumbu untuk memasak',
    type: 'INGREDIENT',
    value: 5,
    effect: '{}'
  },
  {
    id: 'meat_cooked',
    name: '🍖 Daging Panggang',
    description: 'Daging yang sudah dimasak dengan sempurna',
    type: 'FOOD',
    value: 30,
    effect: JSON.stringify({
      type: 'HEAL',
      value: 20
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
        attack: 10,
        defense: 10
      },
      duration: 3600 // 1 hour
    })
  },
  {
    id: 'combat_ration',
    name: '🎒 Combat Ration',
    description: 'Makanan praktis untuk pertarungan',
    type: 'FOOD',
    value: 50,
    effect: JSON.stringify({
      type: 'HEAL',
      value: 30,
      stats: {
        attack: 3,
        defense: 3
      },
      duration: 1800 // 30 minutes
    })
  }
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