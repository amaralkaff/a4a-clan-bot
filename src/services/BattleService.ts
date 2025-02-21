import { PrismaClient } from '@prisma/client';
import { CONFIG } from '../config/config';
import { logger } from '../utils/logger';

export class BattleService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  calculateDamage(attackerAttack: number, defenderDefense: number): number {
    const baseDamage = Math.max(attackerAttack - defenderDefense / 2, CONFIG.BATTLE.MIN_DAMAGE);
    
    // Critical hit check
    const isCritical = Math.random() < CONFIG.BATTLE.CRIT_CHANCE;
    const damage = isCritical ? baseDamage * CONFIG.BATTLE.CRIT_MULTIPLIER : baseDamage;
    
    return Math.floor(damage);
  }

  async processBattle(characterId: string, enemyLevel: number) {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
      });

      if (!character) throw new Error('Character not found');

      // Generate enemy stats based on level
      const enemy = {
        health: 50 + (enemyLevel * 10),
        attack: 5 + (enemyLevel * 2),
        defense: 5 + (enemyLevel * 2),
      };

      // Battle simulation
      let characterHealth = character.health;
      let enemyHealth = enemy.health;
      const battleLog = [];

      while (characterHealth > 0 && enemyHealth > 0) {
        // Character attacks
        const characterDamage = this.calculateDamage(character.attack, enemy.defense);
        enemyHealth -= characterDamage;
        battleLog.push(`${character.name} menyerang musuh dan memberikan ${characterDamage} damage!`);

        if (enemyHealth <= 0) break;

        // Enemy attacks
        const enemyDamage = this.calculateDamage(enemy.attack, character.defense);
        characterHealth -= enemyDamage;
        battleLog.push(`Musuh menyerang ${character.name} dan memberikan ${enemyDamage} damage!`);
      }

      // Update character stats
      await this.prisma.character.update({
        where: { id: characterId },
        data: { health: characterHealth },
      });

      return {
        won: characterHealth > 0,
        battleLog,
        remainingHealth: characterHealth,
      };
    } catch (error) {
      logger.error('Error in battle:', error);
      throw error;
    }
  }
}