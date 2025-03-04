import { PrismaClient } from '@prisma/client';
import { CONFIG } from '../config/config';
import { logger } from '../utils/logger';
import { EmbedBuilder, Message, ChatInputCommandInteraction } from 'discord.js';
import { QUEST_TYPES } from '../config/gameData';
import { CharacterService } from './CharacterService';
import { MentorType, QuestType, QuestStatus, Quest } from '../types/game';
import { BaseService } from './BaseService';
import { Cache } from '@/utils/Cache';
import { PaginationManager } from '@/utils/pagination';
import { ErrorHandler, CharacterError } from '@/utils/errors';
import { randomUUID } from 'crypto';
import { DataCache } from './DataCache';

export class QuestError extends Error {
  constructor(message: string, public code: string, public details?: Record<string, any>) {
    super(message);
    this.name = 'QuestError';
  }

  static questNotFound(questId: string): QuestError {
    return new QuestError(
      '❌ Quest tidak ditemukan!',
      'QUEST_NOT_FOUND',
      { questId }
    );
  }

  static insufficientLevel(required: number, current: number): QuestError {
    return new QuestError(
      `❌ Level kamu (${current}) belum cukup! Minimal level ${required}.`,
      'INSUFFICIENT_LEVEL',
      { required, current }
    );
  }

  static alreadyActive(questId: string): QuestError {
    return new QuestError(
      '❌ Quest ini sudah aktif!',
      'QUEST_ALREADY_ACTIVE',
      { questId }
    );
  }

  static notActive(questId: string): QuestError {
    return new QuestError(
      '❌ Quest ini tidak aktif!',
      'QUEST_NOT_ACTIVE',
      { questId }
    );
  }

  static objectivesNotComplete(questId: string): QuestError {
    return new QuestError(
      '❌ Objectives quest belum selesai!',
      'OBJECTIVES_NOT_COMPLETE',
      { questId }
    );
  }

  static dailyLimitReached(): QuestError {
    return new QuestError(
      '❌ Kamu sudah mencapai batas daily quest hari ini!',
      'DAILY_LIMIT_REACHED'
    );
  }
}

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

interface QuestCache {
  state: QuestState;
  lastUpdated: number;
}

export class QuestService extends BaseService {
  private questCache: Cache<QuestCache>;
  private characterService: CharacterService;
  private readonly QUEST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly DAILY_QUEST_LIMIT = 5;
  private readonly dataCache: DataCache;

  constructor(prisma: PrismaClient, characterService: CharacterService) {
    super(prisma);
    this.characterService = characterService;
    this.questCache = new Cache<QuestCache>(this.QUEST_CACHE_TTL);
    this.dataCache = DataCache.getInstance();

    // Set up periodic cache cleanup
    setInterval(() => {
      this.questCache.cleanup();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  private getQuestCacheKey(characterId: string): string {
    return `quest_${characterId}`;
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

  private async getQuestState(characterId: string): Promise<QuestState> {
    const cacheKey = this.getQuestCacheKey(characterId);
    const cached = this.questCache.get(cacheKey);
    
    if (cached) {
      return cached.state;
    }

    // Initialize new state
    const state = this.initQuestState();

    // Load active quests from database
    const activeQuests = await this.prisma.quest.findMany({
      where: {
        characterId,
        status: QuestStatus.ACTIVE
      }
    });

    // Load completed quests
    const completedQuests = await this.prisma.quest.findMany({
      where: {
        characterId,
        status: QuestStatus.COMPLETED
      }
    });

    // Initialize state from database
    activeQuests.forEach(quest => {
      state.activeQuests.set(quest.templateId, {
        questId: quest.templateId,
        objectives: JSON.parse(quest.objectives),
        startedAt: quest.startedAt.getTime(),
        lastUpdated: quest.updatedAt.getTime()
      });
    });

    completedQuests.forEach(quest => {
      state.completedQuests.add(quest.templateId);
    });

    // Cache the state
    this.questCache.set(cacheKey, {
      state,
      lastUpdated: Date.now()
    });

    return state;
  }

  async getAvailableQuests(source: Message | ChatInputCommandInteraction): Promise<void> {
    try {
      const userId = source instanceof Message ? source.author.id : source.user.id;
      const character = await this.characterService.getCharacterByDiscordId(userId);
      
      if (!character) {
        throw CharacterError.notFound(userId);
      }

      const quests = this.dataCache.getQuests();
      const availableQuests = Object.entries(quests)
        .filter(([_, quest]) => quest.requiredLevel <= character.level)
        .map(([templateId, quest]) => ({
          templateId,
          ...quest
        }));

      // Group quests by type
      const groupedQuests = availableQuests.reduce<Record<string, Quest[]>>((acc, quest) => {
        const type = quest.type;
        if (!acc[type]) acc[type] = [];
        acc[type].push(quest);
        return acc;
      }, {});

      await PaginationManager.paginate(source, {
        items: Object.entries(groupedQuests),
        itemsPerPage: 2,
        embedBuilder: async (items, currentPage, totalPages) => {
          const embed = new EmbedBuilder()
            .setTitle('📜 Available Quests')
            .setColor('#FFD700')
            .setDescription('Quests yang tersedia untuk kamu:');

          items.forEach(([type, quests]) => {
            const questList = quests.map(quest => 
              `**${quest.name}** (Lv.${quest.requiredLevel}+)\n` +
              `${quest.description}\n` +
              `💰 Rewards: ${quest.rewards.exp} EXP, ${quest.rewards.coins} coins` +
              (quest.rewards.items?.length ? `\n🎁 Items: ${quest.rewards.items.join(', ')}` : '')
            ).join('\n\n');

            embed.addFields({
              name: `${this.getQuestTypeEmoji(type as QuestType)} ${type} Quests`,
              value: questList || 'No quests available'
            });
          });

          if (totalPages > 1) {
            embed.setFooter({ text: `Page ${currentPage}/${totalPages} • Use /quest list to view` });
          }

          return embed;
        },
        ephemeral: source instanceof ChatInputCommandInteraction
      });
    } catch (error) {
      await ErrorHandler.handle(error, source);
    }
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

  async acceptQuest(source: Message | ChatInputCommandInteraction, questId: string): Promise<void> {
    try {
      const userId = source instanceof Message ? source.author.id : source.user.id;
      const character = await this.characterService.getCharacterByDiscordId(userId);
      
      if (!character) {
        throw CharacterError.notFound(userId);
      }

      const questConfig = this.dataCache.getQuests()[questId];
      if (!questConfig) {
        throw QuestError.questNotFound(questId);
      }

      if (character.level < questConfig.requiredLevel) {
        throw QuestError.insufficientLevel(questConfig.requiredLevel, character.level);
      }

      const state = await this.getQuestState(character.id);

      if (state.activeQuests.has(questId)) {
        throw QuestError.alreadyActive(questId);
      }

      // Check daily quest limit if it's a daily quest
      if (questConfig.isDaily) {
        if (state.dailyQuestsCompleted >= this.DAILY_QUEST_LIMIT) {
          throw QuestError.dailyLimitReached();
        }
      }

      const questProgress: QuestProgress = {
        questId: questId,
        objectives: Object.fromEntries(
          Object.entries(questConfig.objectives).map(([key, value]) => [key, 0])
        ),
        startedAt: Date.now(),
        lastUpdated: Date.now()
      };

      // Create quest in database
      const dbQuest = await this.prisma.quest.create({
        data: {
          id: randomUUID(),
          characterId: character.id,
          templateId: questId,
          name: questConfig.name,
          description: questConfig.description,
          type: questConfig.type,
          objectives: JSON.stringify(questProgress.objectives),
          rewards: JSON.stringify(questConfig.rewards),
          status: QuestStatus.ACTIVE,
          startedAt: new Date(),
          isDaily: questConfig.isDaily || false
        }
      });

      state.activeQuests.set(questId, questProgress);

      const embed = new EmbedBuilder()
        .setTitle('📜 Quest Accepted')
        .setColor('#00ff00')
        .setDescription(questConfig.description)
        .addFields(
          { name: '📊 Objectives', value: this.formatObjectives(questProgress.objectives, questConfig.objectives) },
          { name: '💰 Rewards', value: this.formatRewards(questConfig.rewards) }
        );

      await source.reply({ 
        embeds: [embed],
        ephemeral: source instanceof ChatInputCommandInteraction
      });
    } catch (error) {
      await ErrorHandler.handle(error, source);
    }
  }

  private formatObjectives(current: { [key: string]: number }, required: { [key: string]: number }): string {
    return Object.entries(required)
      .map(([key, value]) => {
        const progress = current[key] || 0;
        const formattedKey = key.replace(/_/g, ' ').toUpperCase();
        return `• ${formattedKey}: ${progress}/${value}`;
      })
      .join('\n');
  }

  private formatRewards(rewards: Quest['rewards']): string {
    let text = `• ✨ ${rewards.exp} EXP\n• 💰 ${rewards.coins} coins`;
    if (rewards.items && rewards.items.length > 0) {
      text += `\n• 🎁 Items: ${rewards.items.join(', ')}`;
    }
    return text;
  }

  async updateQuestProgress(
    characterId: string, 
    type: QuestType, 
    progress: { [key: string]: number }
  ): Promise<void> {
    try {
      const state = await this.getQuestState(characterId);

      // Update progress for all active quests of the given type
      for (const [questId, questProgress] of state.activeQuests) {
        const questConfig = this.dataCache.getQuests()[questId];
        if (questConfig.type !== type) continue;

        let updated = false;
        for (const [key, value] of Object.entries(progress)) {
          if (questProgress.objectives[key] !== undefined) {
            questProgress.objectives[key] = Math.min(
              questProgress.objectives[key] + value,
              questConfig.objectives[key]
            );
            updated = true;
          }
        }

        if (updated) {
          questProgress.lastUpdated = Date.now();
          
          // Use the compound unique constraint
          await this.prisma.quest.update({
            where: {
              characterId_templateId_status: {
                characterId,
                templateId: questId,
                status: QuestStatus.ACTIVE
              }
            },
            data: {
              objectives: JSON.stringify(questProgress.objectives),
              updatedAt: new Date()
            }
          });

          // Check if quest is complete
          const isComplete = Object.entries(questProgress.objectives).every(
            ([key, value]) => value >= questConfig.objectives[key]
          );

          if (isComplete) {
            await this.completeQuest(characterId, questId);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error updating quest progress:', error);
      throw error;
    }
  }

  async completeQuest(characterId: string, questId: string): Promise<void> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });
      
      if (!character) {
        throw CharacterError.notFound(characterId);
      }

      const state = await this.getQuestState(characterId);
      const questProgress = state.activeQuests.get(questId);

      if (!questProgress) {
        throw QuestError.notActive(questId);
      }

      const questConfig = this.dataCache.getQuests()[questId];
      if (!questConfig) {
        throw QuestError.questNotFound(questId);
      }

      // Verify all objectives are complete
      const isComplete = Object.entries(questProgress.objectives).every(
        ([key, value]) => value >= questConfig.objectives[key]
      );

      if (!isComplete) {
        throw QuestError.objectivesNotComplete(questId);
      }

      // Update character stats and quest status in transaction
      await this.prisma.$transaction([
        this.prisma.character.update({
          where: { id: characterId },
          data: {
            experience: { increment: questConfig.rewards.exp },
            coins: { increment: questConfig.rewards.coins },
            questPoints: { increment: questConfig.rewards.exp }
          }
        }),
        this.prisma.quest.update({
          where: {
            characterId_templateId_status: {
              characterId,
              templateId: questId,
              status: QuestStatus.ACTIVE
            }
          },
          data: { 
            status: QuestStatus.COMPLETED, 
            completedAt: new Date(),
            updatedAt: new Date()
          }
        })
      ]);

      // Update quest state
      state.activeQuests.delete(questId);
      state.completedQuests.add(questId);
      state.questPoints += questConfig.rewards.exp;

      if (questConfig.isDaily) {
        state.dailyQuestsCompleted++;
      }

      // Update cache
      this.questCache.set(this.getQuestCacheKey(characterId), {
        state,
        lastUpdated: Date.now()
      });

      // Add items to inventory if any
      if (questConfig.rewards.items?.length) {
        for (const itemId of questConfig.rewards.items) {
          await this.characterService.addItems(characterId, itemId, 1);
        }
      }
    } catch (error) {
      this.logger.error('Error completing quest:', error);
      throw error;
    }
  }

  async resetDailyQuests(): Promise<void> {
    try {
      // Reset all daily quests at midnight
      await this.prisma.quest.updateMany({
        where: {
          isDaily: true,
          status: QuestStatus.ACTIVE
        },
        data: {
          status: QuestStatus.EXPIRED
        }
      });

      // Clear cache to force reload
      this.questCache.clear();
    } catch (error) {
      this.logger.error('Error resetting daily quests:', error);
      throw error;
    }
  }
}