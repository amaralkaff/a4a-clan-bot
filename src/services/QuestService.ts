import { PrismaClient, Quest } from '@prisma/client';
import { logger } from '../utils/logger';

interface QuestTemplate {
  name: string;
  description: string;
  reward: number;
  requiredLevel: number;
}

export class QuestService {
  private prisma: PrismaClient;
  private questTemplates: QuestTemplate[] = [
    {
      name: "Luffy's First Mission",
      description: "Bantu Luffy menemukan daging di Starter Island",
      reward: 100,
      requiredLevel: 1
    },
    {
      name: "Zoro's Training",
      description: "Berlatih pedang dengan Zoro di Shell Town",
      reward: 150,
      requiredLevel: 2
    },
    {
      name: "Usopp's Target Practice",
      description: "Latihan menembak dengan Usopp",
      reward: 120,
      requiredLevel: 1
    },
    {
      name: "Sanji's Cooking Challenge",
      description: "Bantu Sanji mencari bahan makanan",
      reward: 200,
      requiredLevel: 3
    }
  ];

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getAvailableQuests(characterId: string): Promise<QuestTemplate[]> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        include: { quests: true }
      });

      if (!character) throw new Error('Character not found');

      // Filter quests based on level and not already taken
      const availableQuests = this.questTemplates.filter(quest => {
        const notTaken = !character.quests.some(
          takenQuest => takenQuest.name === quest.name
        );
        return notTaken && character.level >= quest.requiredLevel;
      });

      return availableQuests;
    } catch (error) {
      logger.error('Error getting available quests:', error);
      throw error;
    }
  }

  async acceptQuest(characterId: string, questName: string) {
    try {
      // Normalize quest name to match template
      const normalizedQuestName = questName.trim();
      
      const questTemplate = this.questTemplates.find(q => 
        q.name.toLowerCase() === normalizedQuestName.toLowerCase()
      );
      
      if (!questTemplate) {
        logger.warn(`Quest not found: ${questName}`);
        logger.warn('Available quests:', this.questTemplates.map(q => q.name));
        throw new Error('Quest not found');
      }

      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        include: { quests: true }
      });

      if (!character) throw new Error('Character not found');

      // Check if character meets level requirement
      if (character.level < questTemplate.requiredLevel) {
        throw new Error(`Level ${questTemplate.requiredLevel} required for this quest`);
      }

      // Check if character already has this quest
      const existingQuest = character.quests.find(q => 
        q.name.toLowerCase() === questTemplate.name.toLowerCase()
      );
      
      if (existingQuest) throw new Error('Quest already accepted');

      // Create new quest
      const quest = await this.prisma.quest.create({
        data: {
          name: questTemplate.name,
          description: questTemplate.description,
          reward: questTemplate.reward,
          characterId: characterId
        }
      });

      logger.info(`Quest accepted: ${quest.name} by character ${character.name}`);
      return quest;
    } catch (error) {
      logger.error('Error accepting quest:', error);
      throw error;
    }
  }

  async completeQuest(characterId: string, questId: string) {
    try {
      const quest = await this.prisma.quest.findFirst({
        where: {
          id: questId,
          characterId: characterId,
          status: 'ACTIVE'
        }
      });

      if (!quest) throw new Error('Active quest not found');

      // Update quest status and give rewards
      await this.prisma.$transaction(async (tx) => {
        // Complete the quest
        await tx.quest.update({
          where: { id: questId },
          data: { status: 'COMPLETED' }
        });

        // Give rewards to character
        await tx.character.update({
          where: { id: characterId },
          data: {
            experience: { increment: quest.reward }
          }
        });

        // Check for level up
        const character = await tx.character.findUnique({
          where: { id: characterId }
        });

        if (character) {
          const newLevel = Math.floor(character.experience / 1000) + 1;
          if (newLevel > character.level) {
            await tx.character.update({
              where: { id: characterId },
              data: {
                level: newLevel,
                health: { increment: 10 },
                attack: { increment: 2 },
                defense: { increment: 2 }
              }
            });
          }
        }
      });

      return { success: true, reward: quest.reward };
    } catch (error) {
      logger.error('Error completing quest:', error);
      throw error;
    }
  }

  async getActiveQuests(characterId: string): Promise<Quest[]> {
    try {
      const quests = await this.prisma.quest.findMany({
        where: {
          characterId,
          status: 'ACTIVE'
        }
      });

      return quests;
    } catch (error) {
      logger.error('Error getting active quests:', error);
      throw error;
    }
  }
}