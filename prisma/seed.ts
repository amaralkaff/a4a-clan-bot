// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { 
  ITEMS, 
  MONSTERS, 
  GameItem, 
  JsonMonster, 
  ItemType,
  Effect,
  EffectType,
  Rarity
} from '../src/config/gameData';
import weaponDataJson from '../src/config/weaponData.json';
import armorDataJson from '../src/config/armorData.json';
import accessoryDataJson from '../src/config/accessoryData.json';
import consumableDataJson from '../src/config/consumableData.json';

const prisma = new PrismaClient();

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

// Type assertion and validation for imported JSON data
const weaponData = Object.entries(weaponDataJson).reduce((acc, [key, item]) => {
  acc[key] = {
    ...item,
    type: 'WEAPON' as ItemType,
    effect: validateAndConvertEffect(item.effect),
    rarity: validateRarity(item.rarity)
  };
  return acc;
}, {} as Record<string, GameItem>);

const armorData = Object.entries(armorDataJson).reduce((acc, [key, item]) => {
  acc[key] = {
    ...item,
    type: 'ARMOR' as ItemType,
    effect: validateAndConvertEffect(item.effect),
    rarity: validateRarity(item.rarity)
  };
  return acc;
}, {} as Record<string, GameItem>);

const accessoryData = Object.entries(accessoryDataJson).reduce((acc, [key, item]) => {
  acc[key] = {
    ...item,
    type: 'ACCESSORY' as ItemType,
    effect: validateAndConvertEffect(item.effect),
    rarity: validateRarity(item.rarity)
  };
  return acc;
}, {} as Record<string, GameItem>);

const consumableData = Object.entries(consumableDataJson).reduce((acc, [key, item]) => {
  acc[key] = {
    ...item,
    type: 'CONSUMABLE' as ItemType,
    effect: validateAndConvertEffect(item.effect),
    rarity: validateRarity(item.rarity)
  };
  return acc;
}, {} as Record<string, GameItem>);

// Combine all item data with proper type checking
const ALL_ITEMS: Record<string, GameItem> = {
  ...ITEMS,
  ...weaponData,
  ...armorData,
  ...accessoryData,
  ...consumableData
};

function convertGameItemToDbItem(id: string, item: GameItem) {
  const effect = validateAndConvertEffect(item.effect);
  
  return {
    id,
    name: item.name,
    description: item.description,
    type: item.type,
    value: item.price,
    effect: JSON.stringify(effect),
    baseStats: JSON.stringify(item.baseStats || {}),
    upgradeStats: JSON.stringify(item.upgradeStats || {}),
    maxDurability: item.maxDurability || null,
    stackLimit: item.stackLimit,
    rarity: item.rarity,
    maxLevel: item.maxLevel || null
  };
}

function convertMonsterToDbMonster(id: string, monster: JsonMonster) {
  // Calculate coins based on level and exp
  const coinsMultiplier = 1.5 + (monster.level * 0.1);
  const baseCoins = Math.floor(monster.exp * coinsMultiplier);
  
  // Calculate drop chances based on monster level
  const dropChance = Math.min(0.3 + (monster.level * 0.01), 0.8);

  // Determine locations based on level
  const locations = ['starter_island'];
  if (monster.level >= 10) locations.push('foosha');
  if (monster.level >= 20) locations.push('syrup_village');
  if (monster.level >= 30) locations.push('baratie');
  if (monster.level >= 40) locations.push('arlong_park');
  if (monster.level >= 50) locations.push('loguetown');

  return {
    id,
    name: monster.name,
    level: monster.level,
    health: monster.health,
    maxHealth: monster.health,
    attack: monster.attack,
    defense: monster.defense,
    exp: monster.exp,
    coins: baseCoins,
    drops: JSON.stringify(monster.drops.map(itemId => ({ itemId, chance: dropChance }))),
    description: `A powerful level ${monster.level} monster that roams the lands`,
    location: JSON.stringify(locations)
  };
}

async function processBatch(items: [string, GameItem][], startIdx: number, batchSize: number) {
  const endIdx = Math.min(startIdx + batchSize, items.length);
  const batch = items.slice(startIdx, endIdx);
  let processed = 0;
  let skipped = 0;

  for (const [itemId, item] of batch) {
    try {
      const dbItem = convertGameItemToDbItem(itemId, item);

      await prisma.item.upsert({
        where: { id: itemId },
        create: dbItem,
        update: dbItem
      });

      processed++;
    } catch (error) {
      skipped++;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { processed, skipped };
}

async function processMonsterBatch(monsters: [string, JsonMonster][], startIdx: number, batchSize: number) {
  const endIdx = Math.min(startIdx + batchSize, monsters.length);
  const batch = monsters.slice(startIdx, endIdx);
  let processed = 0;
  let skipped = 0;

  for (const [monsterId, monster] of batch) {
    try {
      const dbMonster = convertMonsterToDbMonster(monsterId, monster);
      await prisma.monster.upsert({
        where: { id: monsterId },
        create: dbMonster,
        update: dbMonster
      });
      processed++;
    } catch (error) {
      skipped++;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { processed, skipped };
}

async function seedItems() {
  let totalProcessed = 0;
  let totalSkipped = 0;
  let typeStats: Record<string, number> = {};

  try {
    const itemEntries = Object.entries(ALL_ITEMS);
    const BATCH_SIZE = 10; // Increased batch size

    for (let i = 0; i < itemEntries.length; i += BATCH_SIZE) {
      const { processed, skipped } = await processBatch(itemEntries, i, BATCH_SIZE);
      totalProcessed += processed;
      totalSkipped += skipped;

      // Track item types
      itemEntries.slice(i, i + BATCH_SIZE).forEach(([_, item]) => {
        typeStats[item.type] = (typeStats[item.type] || 0) + 1;
      });

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\nItem Seeding Summary:');
    console.log(`✨ Total Items Created/Updated: ${totalProcessed}`);
    console.log(`⚠️ Total Items Skipped: ${totalSkipped}`);
    console.log('\nItems by Type:');
    Object.entries(typeStats).forEach(([type, count]) => {
      console.log(`${type}: ${count} items`);
    });
  } catch (error) {
    console.error('Error during item seeding:', error);
    throw error;
  }
}

async function seedMonsters() {
  let totalProcessed = 0;
  let totalSkipped = 0;
  let levelStats: Record<string, number> = {};

  try {
    const monsterEntries = Object.entries(MONSTERS);
    const BATCH_SIZE = 10; // Increased batch size

    for (let i = 0; i < monsterEntries.length; i += BATCH_SIZE) {
      const { processed, skipped } = await processMonsterBatch(monsterEntries, i, BATCH_SIZE);
      totalProcessed += processed;
      totalSkipped += skipped;

      // Track monster levels
      monsterEntries.slice(i, i + BATCH_SIZE).forEach(([_, monster]) => {
        const levelRange = `Level ${Math.floor(monster.level / 10) * 10}-${Math.floor(monster.level / 10) * 10 + 9}`;
        levelStats[levelRange] = (levelStats[levelRange] || 0) + 1;
      });

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\nMonster Seeding Summary:');
    console.log(`✨ Total Monsters Created/Updated: ${totalProcessed}`);
    console.log(`⚠️ Total Monsters Skipped: ${totalSkipped}`);
    console.log('\nMonsters by Level Range:');
    Object.entries(levelStats).forEach(([range, count]) => {
      console.log(`${range}: ${count} monsters`);
    });
  } catch (error) {
    console.error('Error during monster seeding:', error);
    throw error;
  }
}

async function seedLocations() {
  console.log('\nSeeding locations...');
  
  const locations = [
    {
      id: 'starter_island',
      name: '🏝️ Starter Island',
      description: 'Pulau pertama dalam petualanganmu',
      level: 1
    },
    {
      id: 'foosha',
      name: '🌅 Foosha Village',
      description: 'Desa kecil tempat Luffy dibesarkan',
      level: 1
    },
    {
      id: 'syrup_village',
      name: '🏘️ Syrup Village',
      description: 'Desa tempat tinggal Usopp',
      level: 5
    },
    {
      id: 'baratie',
      name: '🚢 Baratie',
      description: 'Restoran terapung milik Zeff',
      level: 10
    },
    {
      id: 'arlong_park',
      name: '🏰 Arlong Park',
      description: 'Markas bajak laut Arlong',
      level: 15
    },
    {
      id: 'loguetown',
      name: '🌆 Loguetown',
      description: 'Kota terakhir sebelum Grand Line',
      level: 20
    },
    {
      id: 'drum_island',
      name: '❄️ Drum Island',
      description: 'Pulau musim dingin tempat Chopper tinggal',
      level: 25
    },
    {
      id: 'cocoyashi',
      name: '🎣 Cocoyashi Village',
      description: 'Desa tempat tinggal Nami',
      level: 30
    }
  ];

  let processed = 0;
  let skipped = 0;

  for (const location of locations) {
    try {
      await prisma.location.upsert({
        where: { id: location.id },
        create: location,
        update: location
      });
      processed++;
    } catch (error) {
      console.error(`Error seeding location ${location.id}:`, error);
      skipped++;
    }
  }

  console.log('\nLocation Seeding Summary:');
  console.log(`✨ Total Locations Created/Updated: ${processed}`);
  console.log(`⚠️ Total Locations Skipped: ${skipped}`);
}

async function main() {
  console.log('Starting database seeding...\n');

  // Seed locations first since they are referenced by characters
  await seedLocations();

  // Seed items
  await seedItems();

  // Seed monsters
  await seedMonsters();

  console.log('\nDatabase seeding completed successfully! 🎉');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });