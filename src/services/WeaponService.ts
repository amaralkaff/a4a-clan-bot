import { PrismaClient } from '@prisma/client';
import { BaseService } from './BaseService';
import { WEAPON_UPGRADES, MATERIALS } from '../config/gameData';
import { EmbedBuilder } from 'discord.js';

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
      // Get character's weapon from inventory
      const weaponInventory = await this.prisma.inventory.findFirst({
        where: {
          characterId,
          itemId: weaponId,
          isEquipped: true
        }
      });

      if (!weaponInventory) {
        return {
          success: false,
          message: '❌ Kamu harus mengequip senjata yang ingin diupgrade!'
        };
      }

      // Get weapon upgrade config
      const weaponConfig = WEAPON_UPGRADES[weaponId as keyof typeof WEAPON_UPGRADES];
      if (!weaponConfig) {
        return {
          success: false,
          message: '❌ Senjata ini tidak bisa diupgrade!'
        };
      }

      // Get current weapon level from effect
      const effect = JSON.parse(weaponInventory.effect || '{}');
      const currentLevel = effect.level || 0;

      // Check if weapon can be upgraded
      if (currentLevel >= weaponConfig.maxLevel) {
        return {
          success: false,
          message: `❌ ${weaponConfig.name} sudah mencapai level maksimal (${weaponConfig.maxLevel})!`
        };
      }

      // Check if character has enough materials
      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        include: {
          inventory: true
        }
      });

      if (!character) {
        return {
          success: false,
          message: '❌ Karakter tidak ditemukan!'
        };
      }

      // Check coins
      if (character.coins < weaponConfig.coins) {
        return {
          success: false,
          message: `❌ Kamu butuh ${weaponConfig.coins} coins untuk upgrade!`
        };
      }

      // Check materials
      for (const [materialId, amount] of Object.entries(weaponConfig.materials)) {
        const material = character.inventory.find(
          item => item.itemId === materialId && item.quantity >= amount
        );

        if (!material) {
          const materialName = MATERIALS[materialId as keyof typeof MATERIALS].name;
          return {
            success: false,
            message: `❌ Kamu butuh ${amount}x ${materialName} untuk upgrade!`
          };
        }
      }

      // Process upgrade
      await this.prisma.$transaction(async (tx) => {
        // Deduct materials
        for (const [materialId, amount] of Object.entries(weaponConfig.materials)) {
          await tx.inventory.update({
            where: {
              characterId_itemId: {
                characterId,
                itemId: materialId
              }
            },
            data: {
              quantity: {
                decrement: amount
              }
            }
          });
        }

        // Deduct coins
        await tx.character.update({
          where: { id: characterId },
          data: {
            coins: {
              decrement: weaponConfig.coins
            }
          }
        });

        // Update weapon stats
        const newLevel = currentLevel + 1;
        const newAttack = weaponConfig.baseAttack + (newLevel * weaponConfig.upgradeAttackPerLevel);

        await tx.inventory.update({
          where: {
            id: weaponInventory.id
          },
          data: {
            effect: JSON.stringify({
              ...effect,
              level: newLevel,
              attack: newAttack
            })
          }
        });
      });

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle('⚔️ Weapon Upgrade Success!')
        .setColor('#00ff00')
        .setDescription(`${weaponConfig.name} telah diupgrade ke level ${currentLevel + 1}!`)
        .addFields(
          { 
            name: '📈 Stats Baru',
            value: `Attack: ${weaponConfig.baseAttack + ((currentLevel + 1) * weaponConfig.upgradeAttackPerLevel)}`,
            inline: true
          },
          {
            name: '📊 Level',
            value: `${currentLevel + 1}/${weaponConfig.maxLevel}`,
            inline: true
          }
        );

      return {
        success: true,
        message: '✅ Upgrade berhasil!',
        embed
      };

    } catch (error) {
      this.logger.error('Error upgrading weapon:', error);
      return {
        success: false,
        message: '❌ Terjadi kesalahan saat upgrade senjata!'
      };
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

      const weaponConfig = WEAPON_UPGRADES[weaponId as keyof typeof WEAPON_UPGRADES];
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
            const material = MATERIALS[id as keyof typeof MATERIALS];
            return `${material.name} x${amount}`;
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
      this.logger.error('Error getting weapon info:', error);
      return null;
    }
  }
} 