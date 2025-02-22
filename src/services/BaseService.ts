// src/services/BaseService.ts
import { PrismaClient } from '@prisma/client';
import { 
  Message, 
  ChatInputCommandInteraction, 
  InteractionResponse,
  MessagePayload,
  InteractionReplyOptions,
  MessageCreateOptions
} from 'discord.js';
import { logger } from '@/utils/logger';

export type InteractionSource = Message | ChatInputCommandInteraction;
export type InteractionResponseType = Promise<Message<boolean> | InteractionResponse<boolean>>;

export class BaseService {
  protected prisma: PrismaClient;
  protected logger = logger;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  protected handleError(error: unknown, context: string): never {
    this.logger.error(`Error in ${context}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Unknown error in ${context}`);
  }

  protected async safeMessageReply(
    message: Message,
    options: string | MessagePayload | MessageCreateOptions
  ): Promise<Message<boolean>> {
    try {
      return await message.reply(options);
    } catch (error) {
      this.logger.error('Error in safeMessageReply:', error);
      throw error;
    }
  }

  protected async safeInteractionReply(
    interaction: ChatInputCommandInteraction,
    options: InteractionReplyOptions
  ): Promise<InteractionResponse<boolean>> {
    try {
      return await interaction.reply(options);
    } catch (error) {
      this.logger.error('Error in safeInteractionReply:', error);
      throw error;
    }
  }
}