import { PrismaClient } from '@prisma/client';
import { BaseService } from './BaseService';
import { Message, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { CharacterService } from './CharacterService';
import { MentorType } from '@/types/game';
import { checkCooldown, setCooldown, getRemainingCooldown } from '@/utils/cooldown';
import { PaginationManager } from '@/utils/pagination';
import { ErrorHandler, CharacterError } from '@/utils/errors';
import { Cache } from '@/utils/Cache';

export class MentorError extends Error {
  constructor(message: string, public code: string, public details?: Record<string, any>) {
    super(message);
    this.name = 'MentorError';
  }

  static noMentor(characterId: string): MentorError {
    return new MentorError(
      '❌ Kamu belum memiliki mentor!',
      'NO_MENTOR',
      { characterId }
    );
  }

  static invalidMentor(mentor: string): MentorError {
    return new MentorError(
      `❌ Mentor "${mentor}" tidak valid!`,
      'INVALID_MENTOR',
      { mentor }
    );
  }

  static insufficientLevel(required: number, current: number): MentorError {
    return new MentorError(
      `❌ Level kamu (${current}) belum cukup! Minimal level ${required} untuk skill spesial.`,
      'INSUFFICIENT_LEVEL',
      { required, current }
    );
  }

  static onCooldown(remainingTime: string): MentorError {
    return new MentorError(
      `⏰ Training sedang cooldown! Tunggu ${remainingTime} lagi.`,
      'ON_COOLDOWN',
      { remainingTime }
    );
  }
}

interface TrainingResult {
  success: boolean;
  message: string;
  exp?: number;
  coins?: number;
  stats?: {
    attack?: number;
    defense?: number;
  };
  progress?: number;
}

interface MentorStats {
  attack?: number;
  defense?: number;
  speed?: number;
  skillName: string;
  description: string;
  unlockLevel: number;
}

interface MentorCache {
  stats: MentorStats;
  lastUpdated: number;
}

export class MentorService extends BaseService {
  private characterService: CharacterService;
  private mentorCache: Cache<MentorCache>;
  private readonly MENTOR_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private readonly MENTOR_STATS: Record<MentorType, MentorStats> = {
    'YB': {
      attack: 5,
      speed: 2,
      skillName: 'Gear Second',
      description: 'Meningkatkan attack dan speed selama 3 turn',
      unlockLevel: 5
    },
    'Tierison': {
      attack: 3,
      defense: 3,
      skillName: 'Three Sword Style',
      description: 'Triple damage pada critical hit',
      unlockLevel: 5
    },
    'LYuka': {
      attack: 2,
      defense: 2,
      speed: 3,
      skillName: 'Special Shot',
      description: '20% chance memberikan poison effect',
      unlockLevel: 5
    },
    'GarryAng': {
      defense: 5,
      speed: 3,
      skillName: 'Black Leg',
      description: '15% chance memberikan burn effect',
      unlockLevel: 5
    }
  };

  constructor(prisma: PrismaClient, characterService: CharacterService) {
    super(prisma);
    this.characterService = characterService;
    this.mentorCache = new Cache<MentorCache>(this.MENTOR_CACHE_TTL);

    // Set up periodic cache cleanup
    setInterval(() => {
      this.mentorCache.cleanup();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  private getMentorCacheKey(mentorType: MentorType): string {
    return `mentor_${mentorType}`;
  }

  private async getMentorStats(mentorType: MentorType): Promise<MentorStats> {
    const cacheKey = this.getMentorCacheKey(mentorType);
    const cached = this.mentorCache.get(cacheKey);
    
    if (cached) {
      return cached.stats;
    }

    const stats = this.MENTOR_STATS[mentorType];
    if (!stats) {
      throw MentorError.invalidMentor(mentorType);
    }

    this.mentorCache.set(cacheKey, {
      stats,
      lastUpdated: Date.now()
    });

    return stats;
  }

  async train(characterId: string, trainingType: string): Promise<TrainingResult> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) {
        throw CharacterError.notFound(characterId);
      }

      const mentor = character.mentor as MentorType;
      if (!mentor) {
        throw MentorError.noMentor(characterId);
      }

      const mentorStats = await this.getMentorStats(mentor);

      // Basic training
      if (trainingType === 'basic') {
        // Calculate training rewards
        const expGain = 50 + Math.floor(Math.random() * 30);
        const progressGain = 1 + Math.floor(Math.random() * 2);

        // Update character in transaction
        await this.prisma.$transaction(async (tx) => {
          // Update stats
          await tx.character.update({
            where: { id: characterId },
            data: {
              attack: mentorStats.attack ? { increment: mentorStats.attack } : undefined,
              defense: mentorStats.defense ? { increment: mentorStats.defense } : undefined,
              speed: mentorStats.speed ? { increment: mentorStats.speed } : undefined,
              experience: { increment: expGain },
              [this.getMentorProgressField(mentor)]: { increment: progressGain }
            }
          });
        });

        // Build result message
        const statChanges = [];
        if (mentorStats.attack) statChanges.push(`+${mentorStats.attack} Attack`);
        if (mentorStats.defense) statChanges.push(`+${mentorStats.defense} Defense`);
        if (mentorStats.speed) statChanges.push(`+${mentorStats.speed} Speed`);

        return {
          success: true,
          message: `✅ Latihan berhasil!\n${statChanges.join(', ')}\n✨ +${expGain} EXP`,
          exp: expGain,
          stats: {
            attack: mentorStats.attack,
            defense: mentorStats.defense
          },
          progress: progressGain
        };
      }

      // Special training
      if (trainingType === 'special') {
        if (character.level < mentorStats.unlockLevel) {
          throw MentorError.insufficientLevel(mentorStats.unlockLevel, character.level);
        }

        const progressGain = 10;
        await this.prisma.character.update({
          where: { id: characterId },
          data: {
            [this.getMentorProgressField(mentor)]: { increment: progressGain }
          }
        });

        return {
          success: true,
          message: `✅ Berhasil mempelajari ${mentorStats.skillName}!\n📝 ${mentorStats.description}`,
          progress: progressGain
        };
      }

      throw new MentorError(
        '❌ Jenis latihan tidak valid!',
        'INVALID_TRAINING_TYPE',
        { trainingType }
      );
    } catch (error) {
      if (error instanceof MentorError || error instanceof CharacterError) {
        return {
          success: false,
          message: error.message
        };
      }
      this.logger.error('Error in train:', error);
      return {
        success: false,
        message: '❌ Terjadi kesalahan saat training.'
      };
    }
  }

  async handleTraining(source: Message | ChatInputCommandInteraction): Promise<void> {
    try {
      const userId = source instanceof Message ? source.author.id : source.user.id;

      // Check cooldown
      if (!checkCooldown(userId, 'train')) {
        const remainingTime = getRemainingCooldown(userId, 'train');
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        throw MentorError.onCooldown(`${minutes}m ${seconds}s`);
      }

      const character = await this.characterService.getCharacterByDiscordId(userId);
      if (!character) {
        throw CharacterError.notFound(userId);
      }

      if (!character.mentor) {
        throw MentorError.noMentor(character.id);
      }

      const mentorStats = await this.getMentorStats(character.mentor as MentorType);
      const result = await this.train(character.id, 'basic');

      if (!result.success) {
        throw new Error(result.message);
      }

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ Training with ${character.mentor}`)
        .setColor('#00ff00')
        .setDescription(this.getTrainingMessage(character.mentor as MentorType))
        .addFields([
          { 
            name: '💪 Stats Gained', 
            value: [
              mentorStats.attack ? `⚔️ Attack: +${mentorStats.attack}` : null,
              mentorStats.defense ? `🛡️ Defense: +${mentorStats.defense}` : null,
              mentorStats.speed ? `💨 Speed: +${mentorStats.speed}` : null
            ].filter(Boolean).join('\n'),
            inline: true 
          },
          { 
            name: '📈 Progress', 
            value: `Current: ${this.getMentorProgress(character)}\nSkill: ${mentorStats.skillName}`,
            inline: true 
          }
        ]);

      if (result.exp) {
        embed.addFields({
          name: '✨ Experience',
          value: `+${result.exp} EXP`,
          inline: true
        });
      }

      // Set cooldown
      setCooldown(userId, 'train');

      await source.reply({ 
        embeds: [embed],
        ephemeral: source instanceof ChatInputCommandInteraction
      });
    } catch (error) {
      await ErrorHandler.handle(error, source);
    }
  }

  private getMentorProgressField(mentor: MentorType): string {
    const fields = {
      'YB': 'luffyProgress',
      'Tierison': 'zoroProgress',
      'LYuka': 'usoppProgress',
      'GarryAng': 'sanjiProgress'
    };
    return fields[mentor];
  }

  private getTrainingMessage(mentor: MentorType): string {
    const messages = {
      'YB': 'Kamu berlatih teknik Gomu Gomu dengan YB! 🥊',
      'Tierison': 'Kamu berlatih teknik pedang dengan Tierison! ⚔️',
      'LYuka': 'Kamu berlatih ketepatan tembakan dengan LYuka! 🎯',
      'GarryAng': 'Kamu berlatih teknik tendangan dengan GarryAng! 🦵'
    };
    return messages[mentor];
  }

  async updateMentorProgress(characterId: string, mentorType: MentorType, amount: number): Promise<void> {
    try {
      const progressField = this.getMentorProgressField(mentorType);
      await this.prisma.character.update({
        where: { id: characterId },
        data: {
          [progressField]: { increment: amount }
        }
      });
    } catch (error) {
      this.logger.error('Error updating mentor progress:', error);
      throw error;
    }
  }

  getMentorProgress(character: any): string {
    const mentor = character.mentor as MentorType;
    if (!mentor) return 'No mentor';

    const progressField = this.getMentorProgressField(mentor);
    const progress = character[progressField] || 0;
    return `${progress}/100`;
  }

  validateMentor(mentor: string): asserts mentor is MentorType {
    if (!Object.keys(this.MENTOR_STATS).includes(mentor)) {
      throw MentorError.invalidMentor(mentor);
    }
  }

  getMentorEmoji(mentor: string): string {
    const emojiMap: { [key: string]: string } = {
      'YB': '🥊',
      'Tierison': '⚔️',
      'LYuka': '🎯',
      'GarryAng': '🦵'
    };
    return emojiMap[mentor] || '❓';
  }
} 