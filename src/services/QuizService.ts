import { PrismaClient } from '@prisma/client';
import { 
  EmbedBuilder, 
  Message, 
  ChatInputCommandInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ButtonInteraction, 
  ComponentType,
  Collection,
  TextChannel,
  DMChannel,
  NewsChannel,
  MessageReplyOptions,
  InteractionReplyOptions,
  CacheType
} from 'discord.js';
import { CharacterService } from './CharacterService';
import { BaseService } from './BaseService';
import { ErrorHandler, CharacterError } from '@/utils/errors';
import { logger } from '@/utils/logger';

interface QuizData {
  question: string;
  options: Record<string, string>;
  correctAnswer: string;
}

interface ActiveQuiz {
  question: string;
  options: Record<string, string>;
  correctAnswer: string;
  messageId: string;
}

export class QuizService extends BaseService {
  private characterService: CharacterService;
  private activeQuizzes: Map<string, ActiveQuiz> = new Map();
  private readonly QUIZ_TIMEOUT = 30000; // 30 seconds
  private readonly BASE_REWARD = 50;
  private readonly MAX_MULTIPLIER = 2.0;
  private readonly STREAK_MULTIPLIER = 0.1;

  constructor(prisma: PrismaClient, characterService: CharacterService) {
    super(prisma);
    this.characterService = characterService;
  }

  async startQuiz(source: Message | ChatInputCommandInteraction): Promise<void> {
    try {
      const userId = source instanceof Message ? source.author.id : source.user.id;
      const character = await this.characterService.getCharacterByDiscordId(userId);
      if (!character) {
        await this.reply(source, { content: '❌ Character not found. Use `/start` to create one.' });
        return;
      }

      // Check if user already has an active quiz
      if (this.activeQuizzes.has(userId)) {
        await this.reply(source, { content: '❌ You already have an active quiz!' });
        return;
      }

      // Get a random quiz question
      const quizData = await this.getRandomQuizQuestion();
      if (!quizData) {
        await this.reply(source, { content: '❌ Failed to get a quiz question.' });
        return;
      }

      // Create buttons for each option
      const row = new ActionRowBuilder<ButtonBuilder>();
      Object.entries(quizData.options).forEach(([key, value]) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`quiz_answer_${key}`)
            .setLabel(value)
            .setStyle(ButtonStyle.Primary)
        );
      });

      // Send the quiz message
      const response = await this.reply(source, {
        embeds: [
          new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📝 Quiz Time!')
            .setDescription(quizData.question)
            .addFields(
              { name: 'Current Streak', value: `${character.quizStreak || 0}`, inline: true },
              { name: 'Multiplier', value: `${(1 + ((character.quizStreak || 0) * this.STREAK_MULTIPLIER)).toFixed(1)}x`, inline: true }
            )
        ],
        components: [row],
        fetchReply: true
      });

      // Store the active quiz
      const messageId = response instanceof Message ? response.id : response.id;
      this.activeQuizzes.set(userId, {
        ...quizData,
        messageId
      });

      // Create message component collector
      const message = response;
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i: ButtonInteraction) => i.user.id === userId && i.customId.startsWith('quiz_answer_'),
        time: this.QUIZ_TIMEOUT
      });

      collector.on('collect', async (interaction: ButtonInteraction) => {
        try {
          // Delete the active quiz before processing to prevent race conditions
          const quiz = this.activeQuizzes.get(interaction.user.id);
          if (!quiz) {
            await interaction.update({ 
              content: '❌ No active quiz found. Use `a q` to start a new quiz.',
              components: []
            });
            return;
          }

          // Delete the quiz before processing to prevent race conditions
          this.activeQuizzes.delete(interaction.user.id);

          // Get the character
          const character = await this.characterService.getCharacterByDiscordId(interaction.user.id);
          if (!character) {
            await interaction.update({
              content: '❌ Character not found. Use `/start` to create one.',
              components: []
            });
            return;
          }

          // Check if the answer is correct
          const answer = interaction.customId.split('_')[2];
          const isCorrect = answer === quiz.correctAnswer;
          const embed = new EmbedBuilder()
            .setColor(isCorrect ? '#00ff00' : '#ff0000')
            .setTitle(isCorrect ? '✅ Correct!' : '❌ Incorrect!')
            .setDescription(`The correct answer was: ${quiz.correctAnswer.toUpperCase()}`);

          // Update streak and calculate rewards
          if (isCorrect) {
            const newStreak = (character.quizStreak || 0) + 1;
            const multiplier = Math.min(1 + (newStreak * this.STREAK_MULTIPLIER), this.MAX_MULTIPLIER);
            const expReward = Math.floor(this.BASE_REWARD * multiplier);
            const coinsReward = Math.floor(this.BASE_REWARD * multiplier);

            // Add rewards
            await this.prisma.character.update({
              where: { id: character.id },
              data: {
                quizStreak: newStreak,
                experience: { increment: expReward },
                coins: { increment: coinsReward }
              }
            });

            embed.addFields(
              { name: 'Streak', value: `${newStreak}`, inline: true },
              { name: 'Multiplier', value: `${multiplier.toFixed(1)}x`, inline: true },
              { name: 'Rewards', value: `+${expReward} EXP\n+${coinsReward} Coins`, inline: true }
            );
          } else {
            await this.prisma.character.update({
              where: { id: character.id },
              data: { quizStreak: 0 }
            });

            embed.addFields(
              { name: 'Streak', value: 'Reset to 0', inline: true }
            );
          }

          // Update the message with the result
          await interaction.update({ 
            embeds: [embed],
            components: [] // Remove buttons after answering
          });
        } catch (error) {
          logger.error('Error in quiz collector:', error);
          try {
            await interaction.update({ 
              content: '❌ An error occurred while processing your answer.',
              components: []
            });
          } catch (replyError) {
            logger.error('Error sending error message:', replyError);
          }
        }
      });

      collector.on('end', async (collected: Collection<string, ButtonInteraction>) => {
        if (collected.size === 0) {
          // Quiz timed out - reset streak
          const hadActiveQuiz = this.activeQuizzes.delete(userId);
          if (hadActiveQuiz) {
            await this.prisma.character.update({
              where: { id: character.id },
              data: { quizStreak: 0 }
            });
            
            const timeoutEmbed = new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('⏰ Time\'s Up!')
              .setDescription('You took too long to answer. Your streak has been reset.')
              .addFields(
                { name: 'Streak', value: 'Reset to 0', inline: true }
              );

            // Try to update the original message
            try {
              if (message instanceof Message) {
                await message.edit({ embeds: [timeoutEmbed], components: [] });
              }
            } catch (error) {
              logger.error('Failed to update timeout message:', error);
            }
          }
        }
      });
    } catch (error) {
      logger.error('Error starting quiz:', error);
      await this.reply(source, { 
        content: '❌ An error occurred while starting the quiz.',
        ephemeral: true 
      });
    }
  }

  private async getRandomQuizQuestion(): Promise<QuizData | null> {
    try {
      const questions = await this.prisma.quiz.findMany({
        take: 1,
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      if (questions.length === 0) return null;

      const randomQuestion = questions[0];
      return {
        question: randomQuestion.question,
        options: typeof randomQuestion.options === 'string' ? JSON.parse(randomQuestion.options) : randomQuestion.options,
        correctAnswer: randomQuestion.correctAnswer
      };
    } catch (error) {
      logger.error('Error getting random quiz question:', error);
      return null;
    }
  }

  private async reply(source: Message | ChatInputCommandInteraction, options: any): Promise<Message | any> {
    if (source instanceof Message) {
      return await source.reply(options);
    } else {
      return await source.reply({ ...options, fetchReply: true });
    }
  }
}