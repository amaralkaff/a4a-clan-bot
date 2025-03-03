import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetEquipmentAndInventory() {
  console.log('Starting equipment and inventory reset...');

  try {
    console.log('Deleting inventory...');
    await prisma.inventory.deleteMany();

    // Reset character equipment only
    console.log('Resetting character equipment...');
    await prisma.character.updateMany({
      data: {
        equippedWeapon: null,
        equippedArmor: null,
        equippedAccessory: null
      }
    });

    console.log('\nEquipment and inventory reset completed successfully! 🎉');
  } catch (error) {
    console.error('Error during reset:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetEquipmentAndInventory()
  .catch((e) => {
    console.error('Reset failed:', e);
    process.exit(1);
  }); 