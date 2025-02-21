import { PrismaClient } from '@prisma/client';
import { CONFIG } from '../config/config';
import { logger } from '../utils/logger';

interface ExplorationEvent {
  type: 'BATTLE' | 'ITEM' | 'NOTHING';
  description: string;
  data?: any;
}

export class ExplorationService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  getIslandConfig(islandName: string) {
    const config = CONFIG.ISLANDS[islandName as keyof typeof CONFIG.ISLANDS];
    if (!config) {
      throw new Error(`Island ${islandName} not found in config`);
    }
    return config;
  }

  private getRandomEvent(): ExplorationEvent {
    const rand = Math.random();
    
    if (rand < 0.4) { // 40% chance for battle
      return {
        type: 'BATTLE',
        description: 'Kamu bertemu dengan musuh!',
        data: {
          enemyLevel: Math.floor(Math.random() * 3) + 1
        }
      };
    } else if (rand < 0.7) { // 30% chance for item
      return {
        type: 'ITEM',
        description: 'Kamu menemukan sesuatu!',
        data: {
          item: {
            name: 'Potion',
            quantity: 1
          }
        }
      };
    } else { // 30% chance for nothing
      return {
        type: 'NOTHING',
        description: 'Tidak ada yang special di sekitar sini.'
      };
    }
  }

  async sail(characterId: string, targetIsland: string) {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');

      const currentIsland = character.currentIsland;
      const islandConfig = CONFIG.ISLANDS[currentIsland as keyof typeof CONFIG.ISLANDS];

      // Check if target island is connected
      if (!islandConfig.connections.includes(targetIsland as any)) {
        throw new Error(`Tidak bisa berlayar ke ${targetIsland} dari ${currentIsland}`);
      }

      // Generate random event during sailing
      const event = this.getRandomEvent();

      // Update character location
      await this.prisma.character.update({
        where: { id: characterId },
        data: { currentIsland: targetIsland }
      });

      return {
        success: true,
        previousIsland: currentIsland,
        newIsland: targetIsland,
        event
      };
    } catch (error) {
      logger.error('Error during sailing:', error);
      throw error;
    }
  }

  async exploreIsland(characterId: string) {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) throw new Error('Character not found');

      const event = this.getRandomEvent();

      return {
        success: true,
        location: character.currentIsland,
        event
      };
    } catch (error) {
      logger.error('Error during island exploration:', error);
      throw error;
    }
  }
}