// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { ITEMS } from '../src/config/gameData';

const prisma = new PrismaClient();

type ItemType = 'WEAPON' | 'ARMOR' | 'ACCESSORY' | 'CONSUMABLE' | 'MATERIAL';
type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
type EffectType = 'EQUIP' | 'HEAL' | 'BUFF' | 'HEAL_AND_BUFF';

interface Stats {
  attack?: number;
  defense?: number;
  health?: number;
}

interface EffectData {
  type: EffectType;
  stats?: Stats;
  health?: number;
  duration?: number;
}

type Effect = EffectData | string;

interface GameItem {
  name: string;
  type: ItemType;
  description: string;
  price: number;
  effect: Effect;
  baseStats?: Stats;
  upgradeStats?: Stats;
  maxLevel?: number;
  rarity: Rarity;
  stackLimit: number;
  maxDurability?: number;
}

function convertGameItemToDbItem(id: string, item: GameItem) {
  return {
    id,
    name: item.name,
    description: item.description,
    type: item.type,
    value: item.price,
    effect: JSON.stringify(item.effect),
    baseStats: JSON.stringify(item.baseStats || {}),
    upgradeStats: JSON.stringify(item.upgradeStats || {}),
    maxDurability: item.maxDurability || null,
    stackLimit: item.stackLimit,
    rarity: item.rarity,
    maxLevel: item.maxLevel || null
  };
}

async function seedItems() {
  console.log('Starting item seeding...');
  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    // Convert gameData items to database format
    const itemEntries = Object.entries(ITEMS);
    
    for (const [itemId, item] of itemEntries) {
      try {
        // Convert item to proper format
        const dbItem = convertGameItemToDbItem(itemId, item as GameItem);
        
        // Upsert the item (create if not exists, update if exists)
        await prisma.item.upsert({
          where: { id: itemId },
          create: dbItem,
          update: dbItem
        });

        if (item.type === 'WEAPON') {
          console.log(`✅ Processed WEAPON: ${item.name}`);
          updated++;
        } else {
          console.log(`📦 Processed ${item.type}: ${item.name}`);
          created++;
        }
      } catch (error) {
        console.error(`❌ Error processing item ${itemId}:`, error);
        skipped++;
      }
    }

    console.log('\nSeeding Summary:');
    console.log(`✨ Created: ${created}`);
    console.log(`🔄 Updated: ${updated}`);
    console.log(`⚠️ Skipped: ${skipped}`);
    console.log('\nItem seeding completed successfully.');
  } catch (error) {
    console.error('Error during item seeding:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedItems();
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