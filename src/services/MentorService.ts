import { PrismaClient } from '@prisma/client';
import { BaseService } from './BaseService';
import { Message, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { CharacterService } from './CharacterService';
import { createEphemeralReply } from '@/utils/helpers';
import { MentorType } from '@/types/game';
import { checkCooldown, setCooldown, getRemainingCooldown } from '@/utils/cooldown';

const NO_CHARACTER_MSG = '❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.';

interface TrainingResult {
  success: boolean;
  message: string;
  exp?: number;
  coins?: number;
}

interface MentorStats {
  attack?: number;
  defense?: number;
}

type MentorTrainingStats = {
  [K in MentorType]: MentorStats;
};

export class MentorService extends BaseService {
  private characterService: CharacterService;

  constructor(prisma: PrismaClient, characterService: CharacterService) {
    super(prisma);
    this.characterService = characterService;
  }

  async train(characterId: string, trainingType: string): Promise<TrainingResult> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) {
        throw new Error('Character not found');
      }

      const mentor = character.mentor as MentorType;
      if (!mentor) {
        throw new Error('No mentor assigned');
      }

      // Basic training gives stats based on mentor
      if (trainingType === 'basic') {
        const stats: MentorTrainingStats = {
          'YB': { attack: 5 },           // Luffy - Attack focus
          'Tierison': { defense: 5 },    // Zoro - Defense focus
          'LYuka': { attack: 3, defense: 3 }, // Usopp - Balanced
          'GarryAng': { defense: 5 }     // Sanji - Defense focus
        };

        const mentorStats = stats[mentor];
        if (!mentorStats) {
          throw new Error('Invalid mentor type');
        }

        // Update character stats
        await this.prisma.character.update({
          where: { id: characterId },
          data: {
            attack: mentorStats.attack ? { increment: mentorStats.attack } : undefined,
            defense: mentorStats.defense ? { increment: mentorStats.defense } : undefined
          }
        });

        // Build result message
        const statChanges = [];
        if (mentorStats.attack) {
          statChanges.push(`+${mentorStats.attack} Attack`);
        }
        if (mentorStats.defense) {
          statChanges.push(`+${mentorStats.defense} Defense`);
        }

        return {
          success: true,
          message: `✅ Latihan berhasil! ${statChanges.join(', ')}`
        };
      }

      // Special training unlocks mentor-specific abilities
      if (trainingType === 'special') {
        // Check if character meets level requirement (level 5)
        if (character.level < 5) {
          return {
            success: false,
            message: '❌ Kamu harus mencapai level 5 untuk membuka skill spesial!'
          };
        }

        const skills = {
          'YB': 'Gear Second',
          'Tierison': 'Three Sword Style',
          'LYuka': 'Special Shot',
          'GarryAng': 'Black Leg'
        };

        const skill = skills[mentor];
        if (!skill) {
          throw new Error('Invalid mentor type');
        }

        // Update mentor progress
        await this.prisma.character.update({
          where: { id: characterId },
          data: {
            [`${mentor.toLowerCase()}Progress`]: { increment: 10 }
          }
        });

        return {
          success: true,
          message: `✅ Berhasil mempelajari teknik ${skill}!`
        };
      }

      return {
        success: false,
        message: '❌ Jenis latihan tidak valid!'
      };
    } catch (error) {
      return this.handleError(error, 'Train');
    }
  }

  async handleTraining(message: Message) {
    // Check cooldown
    if (!checkCooldown(message.author.id, 'train')) {
      const remainingTime = getRemainingCooldown(message.author.id, 'train');
      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;
      return message.reply(`⏰ Training sedang cooldown! Tunggu ${minutes}m ${seconds}s lagi.`);
    }

    const character = await this.prisma.character.findFirst({
      where: {
        user: {
          discordId: message.author.id
        }
      }
    });

    if (!character) {
      return message.reply('❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.');
    }

    // Get mentor progress
    let progress = 0;
    switch(character.mentor) {
      case 'YB':
        progress = character.luffyProgress;
        break;
      case 'Tierison':
        progress = character.zoroProgress;
        break;
      case 'LYuka':
        progress = character.usoppProgress;
        break;
      case 'GarryAng':
        progress = character.sanjiProgress;
        break;
    }

    // Calculate training rewards
    const expGain = 50 + Math.floor(Math.random() * 30);
    const progressGain = 1 + Math.floor(Math.random() * 2);

    // Update character
    await this.prisma.$transaction([
      // Add exp
      this.prisma.character.update({
        where: { id: character.id },
        data: {
          experience: { increment: expGain }
        }
      }),
      // Update mentor progress
      this.prisma.character.update({
        where: { id: character.id },
        data: {
          [this.getMentorProgressField(character.mentor as MentorType)]: { increment: progressGain }
        }
      })
    ]);

    const embed = new EmbedBuilder()
      .setTitle('⚔️ Training Result')
      .setColor('#00ff00')
      .setDescription(this.getTrainingMessage(character.mentor as MentorType))
      .addFields([
        { name: '✨ Experience', value: `+${expGain} EXP`, inline: true },
        { name: '📈 Progress', value: `+${progressGain} (Total: ${progress + progressGain})`, inline: true }
      ]);

    // Set cooldown
    setCooldown(message.author.id, 'train');

    return message.reply({ embeds: [embed] });
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

  async updateMentorProgress(characterId: string, mentorType: MentorType, amount: number) {
    try {
      const progressField = this.getMentorProgressField(mentorType);
      await this.prisma.character.update({
        where: { id: characterId },
        data: {
          [progressField]: { increment: amount }
        }
      });
    } catch (error) {
      return this.handleError(error, 'UpdateMentorProgress');
    }
  }

  getMentorProgress(stats: any): string {
    const mentorProgress = [];
    if (stats.luffyProgress > 0) mentorProgress.push(`YB: ${stats.luffyProgress}`);
    if (stats.zoroProgress > 0) mentorProgress.push(`Tierison: ${stats.zoroProgress}`);
    if (stats.usoppProgress > 0) mentorProgress.push(`LYuka: ${stats.usoppProgress}`);
    if (stats.sanjiProgress > 0) mentorProgress.push(`GarryAng: ${stats.sanjiProgress}`);
    return mentorProgress.length > 0 ? mentorProgress.join('\n') : 'Tidak ada progress';
  }

  validateMentor(mentor: string): asserts mentor is MentorType {
    const validMentors = ['YB', 'Tierison', 'LYuka', 'GarryAng'];
    if (!validMentors.includes(mentor)) {
      throw new Error('Invalid mentor type');
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