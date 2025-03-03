import { PrismaClient } from '@prisma/client';
import { LOCATIONS } from '../src/config/gameData';

const prisma = new PrismaClient();

async function seedLocations() {
  console.log('Starting location seeding...');
  
  try {
    // Upsert each location
    for (const [locationId, location] of Object.entries(LOCATIONS)) {
      await prisma.location.upsert({
        where: { id: locationId },
        update: {
          name: location.name,
          description: location.description,
          level: location.level
        },
        create: {
          id: locationId,
          name: location.name,
          description: location.description,
          level: location.level
        }
      });
      console.log(`✅ Processed location: ${location.name}`);
    }

    console.log('\nLocation seeding completed successfully! 🎉');
  } catch (error) {
    console.error('Error during location seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedLocations()
  .catch((e) => {
    console.error('Location seeding failed:', e);
    process.exit(1);
  }); 