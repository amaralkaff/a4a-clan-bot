import { PrismaClient } from '@prisma/client';
import { injectable } from 'tsyringe';
import { WeaponUpgradeData, MaterialData, ITEMS } from '../config/gameData';
import { BaseService } from './BaseService';
import { EmbedBuilder } from 'discord.js';

interface WeaponMaterials {
  [key: string]: number;
}

interface WeaponConfig extends WeaponUpgradeData {
  id: string;
}

const WEAPON_UPGRADES: Record<string, WeaponConfig> = Object.entries(ITEMS)
  .filter(([_, item]) => item.type === 'WEAPON' && item.maxLevel)
  .reduce((acc, [id, item]) => ({
    ...acc,
    [id]: {
      id,
      name: item.name,
      maxLevel: item.maxLevel || 1,
      baseAttack: item.baseStats?.attack || 0,
      upgradeAttackPerLevel: item.upgradeStats?.attack || 0,
      materials: item.effect && typeof item.effect === 'object' ? (item.effect as any).materials || {} : {},
      coins: item.price
    }
  }), {});

const MATERIALS = Object.entries(ITEMS)
  .filter(([_, item]) => item.type === 'MATERIAL')
  .reduce((acc, [id, item]) => ({
    ...acc,
    [id]: {
      id,
      name: item.name,
      description: item.description,
      dropFrom: [],
      rarity: item.rarity,
      stackLimit: item.stackLimit
    }
  }), {} as Record<string, MaterialData>);

@injectable()
export class WeaponService extends BaseService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async upgradeWeapon(characterId: string, weaponId: string): Promise<{
    success: boolean;
    message: string;
    embed?: EmbedBuilder;
  }> {
    try {
      // Get weapon data
      const weaponData = WEAPON_UPGRADES[weaponId];
      if (!weaponData) {
        return { success: false, message: 'Senjata tidak dapat diupgrade' };
      }

      // Get character's weapon
      const weapon = await this.prisma.inventory.findFirst({
        where: {
          characterId,
          itemId: weaponId,
          isEquipped: true
        }
      });

      if (!weapon) {
        return { success: false, message: 'Senjata tidak ditemukan atau tidak diequip' };
      }

      const currentLevel = weapon.level || 0;
      if (currentLevel >= weaponData.maxLevel) {
        return { success: false, message: 'Senjata sudah mencapai level maksimal' };
      }

      // Check materials
      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        include: {
          inventory: true
        }
      });

      if (!character) {
        return { success: false, message: 'Karakter tidak ditemukan' };
      }

      // Check coins
      if (character.coins < weaponData.coins) {
        return { success: false, message: 'Koin tidak cukup' };
      }

      // Check materials
      for (const [materialId, requiredAmount] of Object.entries(weaponData.materials as WeaponMaterials)) {
        const material = character.inventory.find(item => item.itemId === materialId);
        if (!material || material.quantity < requiredAmount) {
          const materialName = MATERIALS[materialId]?.name || materialId;
          return { success: false, message: `Material tidak cukup: ${materialName}` };
        }
      }

      // Initialize stats
      const currentStats = weapon.stats ? JSON.parse(weapon.stats) : {};
      const newStats = {
        attack: (currentStats.attack || weaponData.baseAttack) + weaponData.upgradeAttackPerLevel,
        defense: currentStats.defense || 0
      };

      // All requirements met, perform upgrade
      await this.prisma.$transaction(async (prisma) => {
        // Deduct coins
        await prisma.character.update({
          where: { id: characterId },
          data: {
            coins: { decrement: weaponData.coins }
          }
        });

        // Deduct materials
        for (const [materialId, amount] of Object.entries(weaponData.materials as WeaponMaterials)) {
          await prisma.inventory.updateMany({
            where: {
              characterId,
              itemId: materialId
            },
            data: {
              quantity: { decrement: amount }
            }
          });
        }

        // Update weapon stats
        await prisma.inventory.update({
          where: { id: weapon.id },
          data: {
            level: { increment: 1 },
            stats: JSON.stringify(newStats)
          }
        });
      });

      const embed = new EmbedBuilder()
        .setTitle('⚔️ Weapon Upgrade Success!')
        .setColor('#00ff00')
        .setDescription(`${weaponData.name} telah diupgrade ke level ${currentLevel + 1}!`)
        .addFields(
          { 
            name: '📈 Stats Baru',
            value: `Attack: ${newStats.attack}`,
            inline: true
          },
          {
            name: '📊 Level',
            value: `${currentLevel + 1}/${weaponData.maxLevel}`,
            inline: true
          }
        );

      return {
        success: true,
        message: `Berhasil mengupgrade ${weaponData.name} ke level ${currentLevel + 1}!`,
        embed
      };

    } catch (error) {
      console.error('Error upgrading weapon:', error);
      return { success: false, message: 'Terjadi kesalahan saat mengupgrade senjata' };
    }
  }

  async getWeaponInfo(characterId: string, weaponId: string): Promise<EmbedBuilder | null> {
    try {
      const weaponInventory = await this.prisma.inventory.findFirst({
        where: {
          characterId,
          itemId: weaponId
        }
      });

      if (!weaponInventory) {
        return null;
      }

      const weaponConfig = WEAPON_UPGRADES[weaponId];
      if (!weaponConfig) {
        return null;
      }

      const effect = JSON.parse(weaponInventory.effect || '{}');
      const currentLevel = effect.level || 0;
      const currentAttack = effect.attack || weaponConfig.baseAttack;

      const embed = new EmbedBuilder()
        .setTitle(`${weaponConfig.name} Info`)
        .setColor('#0099ff')
        .addFields(
          { 
            name: '📊 Level',
            value: `${currentLevel}/${weaponConfig.maxLevel}`,
            inline: true
          },
          {
            name: '⚔️ Attack',
            value: `${currentAttack}`,
            inline: true
          }
        );

      // If can be upgraded, show required materials
      if (currentLevel < weaponConfig.maxLevel) {
        const materials = Object.entries(weaponConfig.materials)
          .map(([id, amount]) => {
            const material = MATERIALS[id];
            return material ? `${material.name} x${amount}` : `${id} x${amount}`;
          })
          .join('\n');

        embed.addFields(
          {
            name: '🔨 Material Upgrade',
            value: materials,
            inline: false
          },
          {
            name: '💰 Biaya Upgrade',
            value: `${weaponConfig.coins} coins`,
            inline: true
          }
        );
      }

      return embed;

    } catch (error) {
      console.error('Error getting weapon info:', error);
      return null;
    }
  }
} 