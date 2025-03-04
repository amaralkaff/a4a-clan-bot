import { EmbedFactory } from './embedBuilder';
import { Message, ChatInputCommandInteraction } from 'discord.js';
import { createEphemeralReply } from './helpers';
import { logger } from './logger';

export interface ErrorDetails {
  context: string;
  error: unknown;
  source?: Message | ChatInputCommandInteraction;
  customMessage?: string;
}

export class ErrorUtils {
  static formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'An unknown error occurred';
  }

  static getErrorMessage(details: ErrorDetails): string {
    const baseMessage = details.customMessage || this.formatError(details.error);
    
    // Add context-specific messages
    switch (details.context) {
      case 'INSUFFICIENT_FUNDS':
        return `❌ ${baseMessage}\nCheck your balance with \`/balance\``;
      case 'ITEM_NOT_FOUND':
        return `❌ ${baseMessage}\nCheck available items with \`/shop\``;
      case 'CHARACTER_NOT_FOUND':
        return `❌ ${baseMessage}\nCreate a character with \`/start\``;
      case 'COOLDOWN':
        return `⏰ ${baseMessage}`;
      case 'COMBAT':
        return `⚔️ ${baseMessage}`;
      case 'INVENTORY':
        return `🎒 ${baseMessage}`;
      case 'TRANSACTION':
        return `💰 ${baseMessage}`;
      default:
        return `❌ ${baseMessage}`;
    }
  }

  static async handleError(details: ErrorDetails): Promise<unknown> {
    // Log the error
    logger.error(`Error in ${details.context}:`, details.error);

    // Get formatted message
    const message = this.getErrorMessage(details);

    // Create error embed
    const embed = EmbedFactory.buildErrorEmbed(message);

    // Send response if source is provided
    if (details.source) {
      if (details.source instanceof Message) {
        return details.source.reply({ embeds: [embed] });
      } else {
        if (details.source.deferred) {
          return details.source.editReply({ embeds: [embed] });
        } else if (details.source.replied) {
          return details.source.followUp({ embeds: [embed], ephemeral: true });
        } else {
          return details.source.reply(createEphemeralReply({ content: message }));
        }
      }
    }

    return message;
  }

  // Common error handlers
  static async handleInsufficientFunds(source: Message | ChatInputCommandInteraction, required: number, current: number): Promise<unknown> {
    return this.handleError({
      context: 'INSUFFICIENT_FUNDS',
      error: `You need ${required - current} more coins!`,
      source
    });
  }

  static async handleItemNotFound(source: Message | ChatInputCommandInteraction, itemName: string): Promise<unknown> {
    return this.handleError({
      context: 'ITEM_NOT_FOUND',
      error: `Item "${itemName}" not found!`,
      source
    });
  }

  static async handleCharacterNotFound(source: Message | ChatInputCommandInteraction): Promise<unknown> {
    return this.handleError({
      context: 'CHARACTER_NOT_FOUND',
      error: '❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter baru.',
      source
    });
  }

  static async handleCooldown(source: Message | ChatInputCommandInteraction, timeLeft: string): Promise<unknown> {
    return this.handleError({
      context: 'COOLDOWN',
      error: `Command is on cooldown! Please wait ${timeLeft}`,
      source
    });
  }

  static async handleCombatError(source: Message | ChatInputCommandInteraction, error: unknown): Promise<unknown> {
    return this.handleError({
      context: 'COMBAT',
      error,
      source
    });
  }

  static async handleInventoryError(source: Message | ChatInputCommandInteraction, error: unknown): Promise<unknown> {
    return this.handleError({
      context: 'INVENTORY',
      error,
      source
    });
  }

  static async handleTransactionError(source: Message | ChatInputCommandInteraction, error: unknown): Promise<unknown> {
    return this.handleError({
      context: 'TRANSACTION',
      error,
      source
    });
  }
} 