// src/utils/helpers.ts
import { 
  Message, 
  MessagePayload, 
  ChatInputCommandInteraction,
  MessageReplyOptions,
  TextChannel,
  DMChannel,
  MessageFlags,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  MessageActionRowComponentBuilder,
  InteractionReplyOptions
} from 'discord.js';
import { logger } from './logger';

interface SafeReplyOptions {
  content?: string;
  embeds?: EmbedBuilder[];
  components?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
  files?: AttachmentBuilder[];
}

export function createEphemeralReply(options: { content: string }): InteractionReplyOptions {
  return {
    ...options,
    ephemeral: true
  };
}

export async function safeReply(message: Message, content: string | MessagePayload | MessageReplyOptions) {
  try {
    return await message.reply(content);
  } catch (error) {
    logger.error('Error sending reply:', error);
    try {
      if (message.channel instanceof TextChannel || message.channel instanceof DMChannel) {
        return await message.channel.send(content);
      }
      return null;
    } catch (channelError) {
      logger.error('Error sending channel message:', channelError);
      return null;
    }
  }
}

export async function safeDeferReply(interaction: ChatInputCommandInteraction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }
  } catch (error) {
    logger.error('Error deferring reply:', error);
  }
}

export async function safeEditReply(
  interaction: ChatInputCommandInteraction, 
  content: string | SafeReplyOptions
): Promise<unknown> {
  try {
    const options = typeof content === 'string' 
      ? { content, ephemeral: true } 
      : { ...content, ephemeral: true };

    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(options);
    } else {
      return await interaction.reply(options);
    }
  } catch (error) {
    logger.error('Error editing/sending reply:', error);
    return null;
  }
}

export async function safeFollowUp(
  interaction: ChatInputCommandInteraction, 
  content: string | SafeReplyOptions
): Promise<unknown> {
  try {
    const options = typeof content === 'string' 
      ? { content, ephemeral: true } 
      : { ...content, ephemeral: true };

    return await interaction.followUp(options);
  } catch (error) {
    logger.error('Error sending follow-up:', error);
    return null;
  }
}

export interface ResponseOptions {
  content?: string;
  embeds?: EmbedBuilder[];
  ephemeral?: boolean;
}

export async function sendResponse(
  source: Message | ChatInputCommandInteraction,
  options: ResponseOptions
) {
  try {
    if (source instanceof ChatInputCommandInteraction) {
      return source.reply({
        content: options.content,
        embeds: options.embeds,
        flags: options.ephemeral ? MessageFlags.Ephemeral : undefined
      });
    } else {
      return source.reply({
        content: options.content,
        embeds: options.embeds
      });
    }
  } catch (error) {
    logger.error('Error sending response:', error);
    if (source instanceof Message && 
       (source.channel instanceof TextChannel || source.channel instanceof DMChannel)) {
      return source.channel.send({
        content: options.content,
        embeds: options.embeds
      });
    }
    throw error;
  }
}

// Helper untuk parsing JSON dengan nilai default
export function parseJsonField<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString);
  } catch {
    return defaultValue;
  }
}