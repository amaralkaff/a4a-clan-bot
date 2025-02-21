import { BaseService } from './BaseService';
import { Character, PrismaClient } from '@prisma/client';
import { CONFIG } from '../config/config';
import { CharacterStats, CreateCharacterDto } from '@/types/game';

export class CharacterService extends BaseService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async createCharacter(dto: CreateCharacterDto): Promise<Character> {
    try {
      const { discordId, name, mentor } = dto;

      const existingUser = await this.prisma.user.findUnique({
        where: { discordId },
        include: { character: true },
      });

      if (existingUser?.character) {
        throw new Error('Character already exists');
      }

      // Hitung base stats berdasarkan mentor
      let attack = CONFIG.STARTER_STATS.ATTACK;
      let defense = CONFIG.STARTER_STATS.DEFENSE;
      
      switch(mentor) {
        case 'YB': // Luffy
          attack = Math.floor(attack * 1.15); // +15% Attack
          defense = Math.floor(defense * 0.9); // -10% Defense
          break;
        case 'Tierison': // Zoro
          attack = Math.floor(attack * 1.1); // +10% Attack
          defense = Math.floor(defense * 1.1); // +10% Defense
          break;
        case 'LYuka': // Usopp
          attack = Math.floor(attack * 0.9); // -10% Attack
          defense = Math.floor(defense * 1.2); // +20% Defense
          break;
        case 'GarryAng': // Sanji
          attack = Math.floor(attack * 1.05); // +5% Attack
          defense = Math.floor(defense * 1.15); // +15% Defense
          break;
      }

      const user = await this.prisma.user.create({
        data: {
          discordId,
          character: {
            create: {
              name,
              mentor,
              level: 1,
              experience: 0,
              health: CONFIG.STARTER_STATS.HEALTH,
              attack,
              defense,
            },
          },
        },
        include: { character: true },
      });

      return user.character!;
    } catch (error) {
      return this.handleError(error, 'CreateCharacter');
    }
  }

  async getCharacterByDiscordId(discordId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { discordId },
        include: { character: true }
      });

      return user?.character || null;
    } catch (error) {
      return this.handleError(error, 'GetCharacterByDiscordId');
    }
  }

  async getCharacterStats(characterId: string): Promise<CharacterStats> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) {
        throw new Error('Character not found');
      }

      return {
        level: character.level,
        experience: character.experience,
        health: character.health,
        maxHealth: this.calculateMaxHealth(character.level),
        attack: character.attack,
        defense: character.defense,
        location: character.currentIsland,
        mentor: character.mentor || undefined,
        luffyProgress: character.luffyProgress,
        zoroProgress: character.zoroProgress,
        usoppProgress: character.usoppProgress,
        sanjiProgress: character.sanjiProgress
      };
    } catch (error) {
      return this.handleError(error, 'GetCharacterStats');
    }
  }

  private calculateMaxHealth(level: number): number {
    return CONFIG.STARTER_STATS.HEALTH + ((level - 1) * 10);
  }

  async heal(characterId: string, amount: number): Promise<number> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');

      const maxHealth = this.calculateMaxHealth(character.level);
      const newHealth = Math.min(character.health + amount, maxHealth);

      await this.prisma.character.update({
        where: { id: characterId },
        data: { health: newHealth }
      });

      return newHealth;
    } catch (error) {
      return this.handleError(error, 'Heal');
    }
  }

  async addExperience(characterId: string, amount: number): Promise<{
    leveledUp: boolean;
    newLevel?: number;
    newExp: number;
  }> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');

      const newExp = character.experience + amount;
      const currentLevel = character.level;
      const expNeeded = this.calculateExpNeeded(currentLevel);

      if (newExp >= expNeeded) {
        // Level up!
        const newLevel = currentLevel + 1;
        await this.prisma.character.update({
          where: { id: characterId },
          data: {
            level: newLevel,
            experience: newExp,
            health: this.calculateMaxHealth(newLevel),
            attack: { increment: 2 },
            defense: { increment: 2 }
          }
        });

        return {
          leveledUp: true,
          newLevel,
          newExp
        };
      } else {
        await this.prisma.character.update({
          where: { id: characterId },
          data: {
            experience: newExp
          }
        });

        return {
          leveledUp: false,
          newExp
        };
      }
    } catch (error) {
      return this.handleError(error, 'AddExperience');
    }
  }

  private calculateExpNeeded(level: number): number {
    return level * 1000;
  }

  async healWithSanji(characterId: string): Promise<{
    success: boolean;
    message: string;
    newHealth?: number;
  }> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');

      // Reset daily heal count if it's a new day
      if (character.lastHealTime && 
          new Date().getDate() !== character.lastHealTime.getDate()) {
        await this.prisma.character.update({
          where: { id: characterId },
          data: { dailyHealCount: 0 }
        });
      }

      if (character.dailyHealCount >= 3) {
        return {
          success: false,
          message: 'Kamu sudah mencapai batas penggunaan heal Sanji hari ini (3x/hari)'
        };
      }

      const healAmount = Math.floor(character.health * 0.25); // 25% HP heal
      const newHealth = await this.heal(characterId, healAmount);

      await this.prisma.character.update({
        where: { id: characterId },
        data: {
          dailyHealCount: { increment: 1 },
          lastHealTime: new Date()
        }
      });

      return {
        success: true,
        message: `Sanji menyembuhkan ${healAmount} HP!`,
        newHealth
      };
    } catch (error) {
      return this.handleError(error, 'HealWithSanji');
    }
  }
}