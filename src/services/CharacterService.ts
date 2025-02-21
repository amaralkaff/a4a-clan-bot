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
      const { discordId, name } = dto;

      const existingUser = await this.prisma.user.findUnique({
        where: { discordId },
        include: { character: true },
      });

      if (existingUser?.character) {
        throw new Error('Character already exists');
      }

      const user = await this.prisma.user.create({
        data: {
          discordId,
          character: {
            create: {
              name,
              level: 1,
              experience: 0,
              health: CONFIG.STARTER_STATS.HEALTH,
              attack: CONFIG.STARTER_STATS.ATTACK,
              defense: CONFIG.STARTER_STATS.DEFENSE,
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
        location: character.currentIsland
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
}