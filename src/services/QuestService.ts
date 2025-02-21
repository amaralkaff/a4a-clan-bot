import { PrismaClient, Quest as PrismaQuest } from '@prisma/client';
import { CONFIG } from '../config/config';
import { logger } from '../utils/logger';
import { EmbedBuilder } from 'discord.js';
import { QUESTS } from '../config/gameData';
import { CharacterService } from './CharacterService';
import { MentorType } from '@/types/game';
import { BaseService } from './BaseService';

interface QuestObjective {
  type: string;
  current: number;
  required: number;
  completed: boolean;
}

interface QuestReward {
  experience: number;
  questPoints: number;
  items: string[];
}

interface DatabaseQuest {
  id: string;
  name: string;
  description: string;
  type: string;
  objectives: string;
  rewards: string;
  reward: number;
  status: string;
  characterId: string;
  createdAt: Date;
  updatedAt: Date;
  isDaily: boolean;
  expiresAt: Date | null;
}

interface Quest extends DatabaseQuest {
  requiredLevel: number;
  mentor?: string;
  items?: string[];
}

interface QuestProgress {
  questId: string;
  objectives: string;
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
  private questStates: Map<string, QuestState>;
  private characterService: CharacterService;

  constructor(prisma: PrismaClient, characterService: CharacterService) {
    super(prisma);
    this.questStates = new Map();
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

  private async applyMentorEffects(character: any, state: QuestState): Promise<{
    bonusReward: number;
    messages: string[];
  }> {
    const messages: string[] = [];
    let bonusReward = 0;

    switch (character.mentor) {
      case 'LYuka': // Usopp
        // 25% bonus rewards for all quests
        bonusReward = 0.25;
        if (state.questPoints >= 100) {
          messages.push('🎯 Keahlian Usopp memberikan bonus reward!');
        }
        break;

      case 'YB': // Luffy
        // Combat quests give extra rewards
        if (state.activeQuests.size > 0) {
          for (const [_, progress] of state.activeQuests) {
            const objectives = JSON.parse(progress.objectives) as QuestObjective[];
            if (objectives.some(o => o.type === 'COMBAT')) {
              bonusReward = 0.2;
              messages.push('👊 Semangat bertarung Luffy meningkatkan reward!');
              break;
            }
          }
        }
        break;

      case 'Tierison': // Zoro
        // Exploration quests give extra rewards
        if (state.activeQuests.size > 0) {
          for (const [_, progress] of state.activeQuests) {
            const objectives = JSON.parse(progress.objectives) as QuestObjective[];
            if (objectives.some(o => o.type === 'EXPLORATION')) {
              bonusReward = 0.2;
              messages.push('🗺️ Petualangan dengan Zoro memberikan bonus reward!');
              break;
            }
          }
        }
        break;

      case 'GarryAng': // Sanji
        // Crafting and gathering quests give extra rewards
        if (state.activeQuests.size > 0) {
          for (const [_, progress] of state.activeQuests) {
            const objectives = JSON.parse(progress.objectives) as QuestObjective[];
            if (objectives.some(o => o.type === 'CRAFTING' || o.type === 'GATHERING')) {
              bonusReward = 0.2;
              messages.push('🍳 Keahlian memasak Sanji memberikan bonus reward!');
              break;
            }
          }
        }
        break;
    }

    return { bonusReward, messages };
  }

  async getAvailableQuests(characterId: string) {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        include: {
          quests: {
            where: {
              status: 'ACTIVE'
            }
          }
        }
      });

      if (!character) throw new Error('Character not found');

      // Load or initialize quest state
      const state = await this.loadQuestState(characterId);
      this.questStates.set(characterId, state);

      // Reset daily quests if needed
      const now = Date.now();
      const lastReset = new Date(state.lastDailyReset);
      const today = new Date();
      if (lastReset.getDate() !== today.getDate()) {
        state.dailyQuestsCompleted = 0;
        state.lastDailyReset = now;
      }

      // Create available quests embed
      const questEmbed = new EmbedBuilder()
        .setTitle('📜 Quest yang Tersedia')
        .setColor('#ffd700');

      // First show active quests with progress
      if (character.quests.length > 0) {
        questEmbed.addFields({
          name: '🔄 Quest Aktif',
          value: character.quests.map(quest => {
            let objectives;
            try {
              objectives = JSON.parse(quest.objectives);
            } catch {
              objectives = [{ current: 0, required: 1 }];
            }
            
            const progressText = objectives.map((obj: any) => {
              const current = obj.current || 0;
              const required = obj.required || 1;
              const percent = Math.floor((current / required) * 100);
              const progressBar = this.createProgressBar(percent);
              return `${progressBar} (${current}/${required})`;
            }).join('\n');

            return `**${quest.name}**\n${quest.description}\n${progressText}\n💰 Reward: ${quest.reward} EXP`;
          }).join('\n\n') || 'Tidak ada quest aktif'
        });
      }

      // Then show available quests
      const availableQuests = Object.entries(QUESTS)
        .filter(([id, quest]) => {
          // Check if quest is not completed
          if (state.completedQuests.has(id)) return false;

          // Check if quest is not already active
          if (state.activeQuests.has(id)) return false;

          // Check level requirement
          if (character.level < quest.requiredLevel) return false;

          // Check mentor requirement
          if (quest.mentor && quest.mentor !== character.mentor) return false;

          // Check daily quest limit
          if (quest.type === 'DAILY' && state.dailyQuestsCompleted >= 3) return false;

          return true;
        })
        .map(([id, quest]) => ({
          id,
          ...quest
        }));

      // Group available quests by type
      const groupedQuests = availableQuests.reduce((acc, quest) => {
        const type = quest.type || 'MISC';
        if (!acc[type]) acc[type] = [];
        acc[type].push(quest);
        return acc;
      }, {} as Record<string, typeof availableQuests>);

      // Add fields for each quest type
      for (const [type, quests] of Object.entries(groupedQuests)) {
        const questList = quests.map(q => 
          `**${q.name}**\n${q.description}\n💰 Reward: ${q.reward} EXP\n📊 Level ${q.requiredLevel}+`
        ).join('\n\n');

        if (questList) {
          questEmbed.addFields({
            name: `${this.getQuestTypeEmoji(type)} ${type}`,
            value: questList
          });
        }
      }

      // Add quest points info
      questEmbed.addFields({
        name: '🎯 Quest Points',
        value: `${state.questPoints} points\n${this.getQuestRank(state.questPoints)}`,
        inline: true
      });

      if (character.mentor === 'LYuka') {
        questEmbed.addFields({
          name: '🎯 Bonus Usopp',
          value: 'Reward +25%',
          inline: true
        });
      }

      return {
        quests: availableQuests,
        embed: questEmbed
      };
    } catch (error) {
      logger.error('Error getting available quests:', error);
      throw error;
    }
  }

  private getQuestTypeEmoji(type: string): string {
    switch (type) {
      case 'COMBAT':
        return '⚔️';
      case 'GATHERING':
        return '🌾';
      case 'EXPLORATION':
        return '🗺️';
      case 'CRAFTING':
        return '⚒️';
      case 'HELP':
        return '🤝';
      case 'DAILY':
        return '📅';
      case 'CRITICAL_HIT':
        return '🎯';
      case 'COMBO':
        return '⚡';
      case 'NAVIGATION':
        return '🧭';
      case 'SECRET_DISCOVERY':
        return '🔍';
      default:
        return '📜';
    }
  }

  private getQuestRank(points: number): string {
    if (points >= 1000) return '👑 Quest Master';
    if (points >= 750) return '⭐⭐⭐ Expert Adventurer';
    if (points >= 500) return '⭐⭐ Seasoned Adventurer';
    if (points >= 250) return '⭐ Adventurer';
    return '🌱 Beginner';
  }

  private async cleanupExpiredQuests(characterId: string): Promise<void> {
    try {
      // Update expired quests
      await this.prisma.quest.updateMany({
        where: {
          characterId,
          expiresAt: {
            lt: new Date()
          },
          status: 'ACTIVE'
        },
        data: {
          status: 'EXPIRED'
        }
      });

      // Get character's quest state
      const state = this.questStates.get(characterId) || this.initQuestState();

      // Get active quests after cleanup
      const activeQuests = await this.prisma.quest.findMany({
        where: {
          characterId,
          status: 'ACTIVE'
        }
      });

      // Update quest state
      state.activeQuests = new Map(
        activeQuests.map(quest => [
          quest.id,
          {
            questId: quest.id,
            objectives: quest.objectives,
            startedAt: quest.createdAt.getTime(),
            lastUpdated: quest.updatedAt.getTime()
          }
        ])
      );

      this.questStates.set(characterId, state);
    } catch (error: unknown) {
      if (error instanceof Error) {
        return this.handleError(error, 'CleanupExpiredQuests');
      }
      return this.handleError(new Error('Unknown error in CleanupExpiredQuests'), 'CleanupExpiredQuests');
    }
  }

  async acceptQuest(characterId: string, questId: string) {
    try {
      // Cleanup expired quests first
      await this.cleanupExpiredQuests(characterId);

      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
      });

      if (!character) throw new Error('Character not found');

      // Validate quest ID
      if (!questId || typeof questId !== 'string') {
        throw new Error('Invalid quest ID');
      }

      // Get quest data from QUESTS config
      const quest = QUESTS[questId as keyof typeof QUESTS];
      if (!quest) {
        this.logger.error(`Quest not found: ${questId}`);
        throw new Error(`Quest "${questId}" tidak ditemukan`);
      }

      const state = this.questStates.get(characterId) || this.initQuestState();

      // Validate quest acceptance
      if (state.activeQuests.has(questId)) {
        throw new Error('Quest sudah aktif');
      }

      if (state.completedQuests.has(questId)) {
        throw new Error('Quest sudah diselesaikan');
      }

      if (character.level < quest.requiredLevel) {
        throw new Error(`Level kamu terlalu rendah (Required: ${quest.requiredLevel})`);
      }

      // Check if quest is from correct mentor
      if (quest.mentor && quest.mentor !== character.mentor) {
        throw new Error(`Quest ini hanya untuk murid ${quest.mentor}`);
      }

      // Set expiration for daily quests
      const expiresAt = quest.type === 'DAILY' ? 
        new Date(new Date().setHours(23, 59, 59, 999)) : // Expires at end of day
        null;

      // Initialize quest progress
      const questProgress: QuestProgress = {
        questId,
        objectives: this.initializeQuestObjectives(quest),
        startedAt: Date.now(),
        lastUpdated: Date.now()
      };

      state.activeQuests.set(questId, questProgress);
      this.questStates.set(characterId, state);

      // Create quest in database
      await this.prisma.quest.create({
        data: {
          id: questId,
          name: quest.name,
          description: quest.description,
          objectives: questProgress.objectives,
          reward: quest.reward,
          type: quest.type,
          isDaily: quest.type === 'DAILY',
          expiresAt,
          characterId
        }
      });

      // Create quest acceptance embed
      const acceptEmbed = new EmbedBuilder()
        .setTitle(`📜 Quest Diterima: ${quest.name}`)
        .setColor('#00ff00')
        .setDescription(quest.description)
        .addFields(
          { name: '📊 Objectives', value: this.formatQuestObjectives(questProgress.objectives) },
          { name: '💰 Reward', value: `${quest.reward} EXP`, inline: true },
          { name: '📈 Required Level', value: `${quest.requiredLevel}+`, inline: true }
        );

      if (quest.mentor) {
        acceptEmbed.addFields({
          name: '👥 Mentor',
          value: quest.mentor,
          inline: true
        });
      }

      if (expiresAt) {
        acceptEmbed.addFields({
          name: '⏰ Expires',
          value: `${expiresAt.toLocaleString()}`,
          inline: true
        });
      }

      return {
        quest,
        progress: questProgress,
        embed: acceptEmbed
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        return this.handleError(error, 'AcceptQuest');
      }
      return this.handleError(new Error('Unknown error in AcceptQuest'), 'AcceptQuest');
    }
  }

  private initializeQuestObjectives(quest: any): string {
    // Convert objectives to JSON string
    let required = 1;
    
    // Set required amount based on quest type
    switch (quest.type) {
      case 'COMBAT':
        required = quest.description.includes('5') ? 5 : 
                  quest.description.includes('10') ? 10 : 3;
        break;
      case 'GATHERING':
        required = quest.description.includes('5') ? 5 : 3;
        break;
      case 'CRITICAL_HIT':
        required = 5;
        break;
      case 'COMBO':
        required = 5;
        break;
      case 'HELP':
        required = 5;
        break;
      case 'CRAFTING':
        required = 3;
        break;
      default:
        required = 1;
    }

    const objectives = [{
      type: quest.type,
      current: 0,
      required,
      completed: false
    }];
    return JSON.stringify(objectives);
  }

  private formatQuestObjectives(objectivesJson: string): string {
    try {
      const objectives = JSON.parse(objectivesJson);
      return objectives.map((obj: any) => 
        `${this.getQuestTypeEmoji(obj.type)} ${obj.current}/${obj.required}`
      ).join('\n');
    } catch (error) {
      logger.error('Error parsing objectives:', error);
      return 'Error displaying objectives';
    }
  }

  async updateQuestProgress(characterId: string, type: string, amount: number = 1) {
    try {
      // Get character with active quests
      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        include: {
          quests: {
            where: {
              status: 'ACTIVE'
            }
          }
        }
      });

      if (!character) throw new Error('Character not found');

      // Initialize or get quest state
      const state = this.questStates.get(characterId) || this.initQuestState();

      // Update each active quest
      for (const dbQuest of character.quests) {
        try {
          let objectives = JSON.parse(dbQuest.objectives);
          let updated = false;

          // Update objectives that match the type
          objectives = objectives.map((objective: QuestObjective) => {
            if (objective.type === type && !objective.completed) {
              objective.current += amount;
              if (objective.current >= objective.required) {
                objective.completed = true;
                objective.current = objective.required;
              }
              updated = true;
            }
            return objective;
          });

          if (updated) {
            // Update quest in database
            await this.prisma.quest.update({
              where: {
                id: dbQuest.id,
                characterId: character.id
              },
              data: {
                objectives: JSON.stringify(objectives)
              }
            });

            // Update quest in state
            state.activeQuests.set(dbQuest.id, {
              questId: dbQuest.id,
              objectives: JSON.stringify(objectives),
              startedAt: dbQuest.createdAt.getTime(),
              lastUpdated: Date.now()
            });

            // Check if all objectives are completed
            if (objectives.every((obj: QuestObjective) => obj.completed)) {
              await this.completeQuest(characterId, dbQuest.id);
            }
          }
        } catch (error) {
          this.logger.error(`Error updating quest ${dbQuest.id}:`, error);
          continue;
        }
      }

      this.questStates.set(characterId, state);
    } catch (error) {
      this.logger.error('Error in updateQuestProgress:', error);
      throw error;
    }
  }

  private async loadQuestState(characterId: string): Promise<QuestState> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        include: {
          quests: {
            where: {
              status: 'ACTIVE'
            }
          }
        }
      });

      if (!character) throw new Error('Character not found');

      const state = this.initQuestState();

      // Load active quests into state
      for (const quest of character.quests) {
        state.activeQuests.set(quest.id, {
          questId: quest.id,
          objectives: quest.objectives,
          startedAt: quest.createdAt.getTime(),
          lastUpdated: quest.updatedAt.getTime()
        });
      }

      return state;
    } catch (error) {
      this.logger.error('Error loading quest state:', error);
      throw error;
    }
  }

  async completeQuest(characterId: string, questId: string) {
    try {
      // Get character with active quests
      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        include: {
          quests: true // Get all quests first to check status
        }
      });

      if (!character) throw new Error('Character not found');

      // Check if quest exists and is active
      const dbQuest = character.quests.find(q => q.id === questId);
      if (!dbQuest) {
        this.logger.error(`Quest with ID ${questId} not found for character ${characterId}`);
        throw new Error('Quest tidak ditemukan');
      }

      if (dbQuest.status !== 'ACTIVE') {
        this.logger.error(`Quest ${questId} status is ${dbQuest.status}, not ACTIVE`);
        throw new Error('Quest tidak aktif');
      }

      // Initialize or get quest state
      const state = this.questStates.get(characterId) || this.initQuestState();
      
      // Get quest progress from state
      let progress = state.activeQuests.get(questId);
      if (!progress) {
        // If quest exists in DB but not in state, initialize it
        const questProgress = {
          questId,
          objectives: dbQuest.objectives,
          startedAt: dbQuest.createdAt.getTime(),
          lastUpdated: dbQuest.updatedAt.getTime()
        };
        state.activeQuests.set(questId, questProgress);
        this.logger.info(`Initialized quest progress for quest ${questId}`);
      }

      // Get quest data from config
      const quest = QUESTS[questId as keyof typeof QUESTS] as Quest;
      if (!quest) {
        this.logger.error(`Quest config not found for ID ${questId}`);
        throw new Error('Quest tidak ditemukan dalam konfigurasi');
      }

      // Check if all objectives are completed
      try {
        this.logger.info(`Validating quest completion for quest ${questId}:`, dbQuest.objectives);
        
        if (!dbQuest.objectives) {
          throw new Error('Quest objectives tidak ditemukan');
        }

        let objectives: QuestObjective[];
        try {
          objectives = JSON.parse(dbQuest.objectives);
        } catch (parseError) {
          this.logger.error('Error parsing quest objectives:', parseError);
          throw new Error('Format quest objectives tidak valid');
        }

        if (!Array.isArray(objectives)) {
          throw new Error('Quest objectives harus berupa array');
        }

        if (objectives.length === 0) {
          throw new Error('Quest objectives kosong');
        }

        const incompleteObjectives = objectives.filter(obj => !obj.completed);
        if (incompleteObjectives.length > 0) {
          const remaining = incompleteObjectives.map(obj => 
            `${obj.type}: ${obj.current}/${obj.required}`
          ).join(', ');
          throw new Error(`Quest belum selesai. Sisa objective: ${remaining}`);
        }

        this.logger.info('Quest objectives validation successful');
      } catch (error) {
        this.logger.error('Error validating quest completion:', error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Error validating quest completion');
      }

      // Apply mentor effects
      const { bonusReward, messages } = await this.applyMentorEffects(character, state);

      // Calculate final reward
      const finalReward = Math.floor(quest.reward * (1 + bonusReward));

      // Create rewards object
      const rewards: QuestReward = {
        experience: finalReward,
        questPoints: quest.reward,
        items: quest.items || []
      };

      // Update character stats and quest status in transaction
      await this.prisma.$transaction([
        // Update character stats
        this.prisma.character.update({
          where: { id: characterId },
          data: {
            experience: { increment: finalReward },
            questPoints: { increment: quest.reward }
          }
        }),
        // Update quest status
        this.prisma.quest.update({
          where: {
            id: questId,
            characterId: characterId
          },
          data: {
            status: 'COMPLETED',
            updatedAt: new Date(),
            rewards: JSON.stringify(rewards)
          }
        })
      ]);

      // Update quest state
      state.activeQuests.delete(questId);
      state.completedQuests.add(questId);
      state.questPoints += quest.reward;
      if (quest.type === 'DAILY') {
        state.dailyQuestsCompleted++;
      }
      this.questStates.set(characterId, state);

      // Create completion embed
      const completeEmbed = new EmbedBuilder()
        .setTitle(`🎉 Quest Selesai: ${quest.name}`)
        .setColor('#00ff00')
        .setDescription('Selamat! Kamu telah menyelesaikan quest ini!')
        .addFields(
          { name: '💰 Reward', value: `${finalReward} EXP${bonusReward > 0 ? ` (Bonus: +${Math.floor(bonusReward * 100)}%)` : ''}`, inline: true },
          { name: '🎯 Quest Points', value: `+${quest.reward} (Total: ${state.questPoints})`, inline: true }
        );

      if (rewards.items.length > 0) {
        completeEmbed.addFields({
          name: '🎁 Items',
          value: rewards.items.map((item: string) => `• ${item}`).join('\n')
        });
      }

      if (messages.length > 0) {
        completeEmbed.addFields({
          name: '👥 Mentor Effects',
          value: messages.join('\n')
        });
      }

      // Update mentor progress if quest has mentor
      if (quest.mentor && typeof quest.mentor === 'string') {
        await this.characterService.updateMentorProgress(characterId, quest.mentor as MentorType, 10);
      }

      return {
        reward: finalReward,
        questPoints: state.questPoints,
        embed: completeEmbed
      };
    } catch (error) {
      this.logger.error('Error completing quest:', error);
      throw error;
    }
  }

  async getActiveQuests(characterId: string): Promise<{
    quests: DatabaseQuest[];
    embed: EmbedBuilder;
  }> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        include: {
          quests: {
            where: {
              status: 'ACTIVE'
            }
          }
        }
      });

      if (!character) throw new Error('Character not found');

      const state = this.questStates.get(characterId) || this.initQuestState();

      // Create active quests embed
      const questEmbed = new EmbedBuilder()
        .setTitle('📜 Quest Aktif')
        .setColor('#0099ff');

      if (character.quests.length > 0) {
        const questsByType = character.quests.reduce((acc, quest) => {
          const type = quest.type;
          if (!acc[type]) acc[type] = [];
          acc[type].push(quest);
          return acc;
        }, {} as Record<string, DatabaseQuest[]>);

        for (const [type, quests] of Object.entries(questsByType)) {
          const questList = quests.map(q => 
            `**${q.name}**\n${q.description}\n💰 Reward: ${q.reward} EXP`
          ).join('\n\n');

          questEmbed.addFields({
            name: `${this.getQuestTypeEmoji(type)} ${type}`,
            value: questList
          });
        }
      } else {
        questEmbed.setDescription('❌ Tidak ada quest yang aktif');
      }

      return {
        quests: character.quests,
        embed: questEmbed
      };
    } catch (error) {
      logger.error('Error getting active quests:', error);
      throw error;
    }
  }

  private createProgressBar(percent: number): string {
    const barLength = 10;
    const filledBars = Math.floor((percent / 100) * barLength);
    const emptyBars = barLength - filledBars;
    return `[${'🟩'.repeat(filledBars)}${'⬜'.repeat(emptyBars)}] ${percent}%`;
  }
}