import { PrismaClient } from '@prisma/client';
import { CONFIG } from '../config/config';
import { logger } from '../utils/logger';
import { EmbedBuilder } from 'discord.js';
import { QUESTS, QUEST_TYPES } from '../config/gameData';
import { CharacterService } from './CharacterService';
import { MentorType, QuestType, QuestStatus, Quest } from '../types/game';
import { BaseService } from './BaseService';
import { CommandInteraction } from 'discord.js';
import { randomUUID } from 'crypto';

interface QuestProgress {
  questId: string;
  objectives: { [key: string]: number };
  startedAt: number;
  lastUpdated: number;
}

interface QuestState {
  activeQuests: Map<string, QuestProgress>;
  completedQuests: Set<string>;
  questPoints: number;
  dailyQuestsCompleted: number;
  lastDailyReset: number;
}

export class QuestService extends BaseService {
  private questStates: Map<string, QuestState> = new Map();
  private characterService: CharacterService;

  constructor(prisma: PrismaClient, characterService: CharacterService) {
    super(prisma);
    this.characterService = characterService;
  }

  private initQuestState(): QuestState {
    return {
      activeQuests: new Map(),
      completedQuests: new Set(),
      questPoints: 0,
      dailyQuestsCompleted: 0,
      lastDailyReset: Date.now()
    };
  }

  async getAvailableQuests(characterId: string) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId }
    });
    
    if (!character) {
      throw new Error('Character not found');
    }

    const availableQuests = Object.values(QUESTS).filter(quest => {
      return quest.requiredLevel <= character.level;
    });

    const embed = new EmbedBuilder()
      .setTitle('📜 Available Quests')
      .setColor('#FFD700');

    const groupedQuests = availableQuests.reduce((acc, quest) => {
      const type = quest.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(quest);
      return acc;
    }, {} as Record<string, Quest[]>);

    for (const [type, quests] of Object.entries(groupedQuests)) {
      const questList = quests.map(q => 
        `**${q.name}**\n${q.description}\n💰 Rewards: ${q.rewards.exp} EXP, ${q.rewards.coins} coins`
      ).join('\n\n');

      if (questList) {
        embed.addFields({
          name: `${this.getQuestTypeEmoji(type as QuestType)} ${type}`,
          value: questList
        });
      }
    }

    return { quests: availableQuests, embed };
  }

  private getQuestTypeEmoji(type: QuestType): string {
    const emojis: Record<QuestType, string> = {
      [QUEST_TYPES.COMBAT]: '⚔️',
      [QUEST_TYPES.GATHER]: '🌾',
      [QUEST_TYPES.EXPLORE]: '🗺️',
      [QUEST_TYPES.CRAFT]: '⚒️',
      [QUEST_TYPES.HELP]: '💡'
    };
    return emojis[type] || '📜';
  }

  async acceptQuest(characterId: string, questId: string) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId }
    });
    
    if (!character) {
      throw new Error('Character not found');
    }

    const questConfig = QUESTS[questId];
    if (!questConfig) {
      throw new Error('Quest not found');
    }

    if (character.level < questConfig.requiredLevel) {
      throw new Error(`You need to be level ${questConfig.requiredLevel} to accept this quest`);
    }

    let state = this.questStates.get(characterId);
    if (!state) {
      state = this.initQuestState();
      this.questStates.set(characterId, state);
    }

    if (state.activeQuests.has(questId)) {
      throw new Error('You already have this quest active');
    }

    const questProgress: QuestProgress = {
      questId: questId,
      objectives: { ...questConfig.objectives },
      startedAt: Date.now(),
      lastUpdated: Date.now()
    };

    // Create quest in database
    const dbQuest = await this.prisma.quest.create({
      data: {
        id: randomUUID(),
        characterId: characterId,
        templateId: questId,
        name: questConfig.name,
        description: questConfig.description,
        type: questConfig.type,
        objectives: JSON.stringify(questConfig.objectives),
        rewards: JSON.stringify(questConfig.rewards),
        status: QuestStatus.ACTIVE,
        startedAt: new Date()
      }
    });

    state.activeQuests.set(questId, questProgress);

    const embed = new EmbedBuilder()
      .setTitle('📜 Quest Accepted')
      .setColor('#00ff00')
      .setDescription(questConfig.description)
      .addFields(
        { name: '📊 Objectives', value: this.formatObjectives(questConfig.objectives) },
        { name: '💰 Rewards', value: this.formatRewards(questConfig.rewards) }
      );

    return { quest: dbQuest, embed };
  }

  private formatObjectives(objectives: { [key: string]: number }): string {
    return Object.entries(objectives)
      .map(([key, value]) => `• ${key.replace(/_/g, ' ').toUpperCase()}: 0/${value}`)
      .join('\n');
  }

  private formatRewards(rewards: Quest['rewards']): string {
    let text = `• ${rewards.exp} EXP\n• ${rewards.coins} coins`;
    if (rewards.items && rewards.items.length > 0) {
      text += `\n• Items: ${rewards.items.join(', ')}`;
    }
    return text;
  }

  async completeQuest(characterId: string, questId: string) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId }
    });
    
    if (!character) {
      throw new Error('Character not found');
    }

    const state = this.questStates.get(characterId);
    if (!state || !state.activeQuests.has(questId)) {
      throw new Error('Quest not active');
    }

    const questConfig = QUESTS[questId];
    if (!questConfig) {
      throw new Error('Quest not found');
    }

    // Update character stats and quest status
    await this.prisma.$transaction([
      this.prisma.character.update({
        where: { id: characterId },
        data: {
          experience: { increment: questConfig.rewards.exp },
          coins: { increment: questConfig.rewards.coins },
          questPoints: { increment: questConfig.rewards.exp }
        }
      }),
      this.prisma.quest.updateMany({
        where: { characterId, templateId: questId, status: QuestStatus.ACTIVE },
        data: { status: QuestStatus.COMPLETED, completedAt: new Date() }
      })
    ]);

    // Update quest state
    state.activeQuests.delete(questId);
    state.completedQuests.add(questId);
    state.questPoints += questConfig.rewards.exp;

    const embed = new EmbedBuilder()
      .setTitle('🎉 Quest Completed!')
      .setColor('#00ff00')
      .setDescription(`Congratulations! You've completed: ${questConfig.name}`)
      .addFields(
        { name: '💰 Rewards', value: this.formatRewards(questConfig.rewards) }
      );

    return { embed };
  }
}