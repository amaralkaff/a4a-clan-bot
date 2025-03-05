import { Message, ChatInputCommandInteraction } from 'discord.js';
import { EmbedFactory } from './embedBuilder';
import { logger } from './logger';

// Base error class for game-specific errors
export class GameError extends Error {
  public readonly context: string;
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(message: string, context: string, code: string, details?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    this.code = code;
    this.details = details;
  }
}

// Character-related errors
export class CharacterError extends GameError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, 'CHARACTER', code, details);
  }

  static notFound(discordId: string): CharacterError {
    return new CharacterError(
      '❌ Kamu belum memiliki karakter! Gunakan `a start` untuk membuat karakter.',
      'CHARACTER_NOT_FOUND',
      { discordId }
    );
  }

  static alreadyExists(discordId: string): CharacterError {
    return new CharacterError(
      '❌ Kamu sudah memiliki karakter! Gunakan `a profile` untuk melihat karaktermu.',
      'CHARACTER_ALREADY_EXISTS',
      { discordId }
    );
  }
}

// Economy-related errors
export class EconomyError extends GameError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, 'ECONOMY', code, details);
  }

  static insufficientFunds(required: number, current: number): EconomyError {
    return new EconomyError(
      `❌ Uang tidak cukup! Kamu butuh ${required - current} coins lagi.`,
      'INSUFFICIENT_FUNDS',
      { required, current, missing: required - current }
    );
  }

  static invalidAmount(amount: number): EconomyError {
    return new EconomyError(
      '❌ Jumlah tidak valid! Harus lebih dari 0.',
      'INVALID_AMOUNT',
      { amount }
    );
  }
}

// Inventory-related errors
export class InventoryError extends GameError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, 'INVENTORY', code, details);
  }

  static itemNotFound(itemId: string): InventoryError {
    return new InventoryError(
      `❌ Item tidak ditemukan!`,
      'ITEM_NOT_FOUND',
      { itemId }
    );
  }

  static stackLimitReached(itemId: string, current: number, limit: number): InventoryError {
    return new InventoryError(
      '❌ Tidak bisa menambah item lagi, stack limit tercapai!',
      'STACK_LIMIT_REACHED',
      { itemId, current, limit }
    );
  }

  static itemEquipped(itemId: string): InventoryError {
    return new InventoryError(
      '❌ Tidak bisa menjual item yang sedang diequip!',
      'ITEM_EQUIPPED',
      { itemId }
    );
  }
}

// Shop-related errors
export class ShopError extends GameError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, 'SHOP', code, details);
  }

  static itemNotFound(itemId: string): ShopError {
    return new ShopError(
      `❌ Item "${itemId}" tidak ditemukan di shop!`,
      'ITEM_NOT_FOUND',
      { itemId }
    );
  }

  static invalidQuantity(quantity: number): ShopError {
    return new ShopError(
      '❌ Jumlah item harus lebih dari 0!',
      'INVALID_QUANTITY',
      { quantity }
    );
  }

  static stackLimitReached(itemId: string, itemName: string, current: number, limit: number): ShopError {
    return new ShopError(
      `❌ Tidak bisa membeli lebih banyak ${itemName}, stack limit tercapai!`,
      'STACK_LIMIT_REACHED',
      { itemId, itemName, current, limit }
    );
  }

  static insufficientFunds(itemName: string, quantity: number, required: number, current: number): ShopError {
    return new ShopError(
      `❌ Uang tidak cukup! Kamu butuh ${required} coins untuk membeli ${quantity}x ${itemName}.`,
      'INSUFFICIENT_FUNDS',
      { itemName, quantity, required, current, missing: required - current }
    );
  }

  static invalidFormat(): ShopError {
    return new ShopError(
      '❌ Format: `a buy [nama_item] [jumlah]`\nContoh: `a buy potion 5`',
      'INVALID_FORMAT'
    );
  }
}

// Combat-related errors
export class CombatError extends GameError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, 'COMBAT', code, details);
  }

  static invalidTarget(targetId: string): CombatError {
    return new CombatError(
      '❌ Target tidak valid!',
      'INVALID_TARGET',
      { targetId }
    );
  }

  static alreadyInCombat(characterId: string): CombatError {
    return new CombatError(
      '❌ Kamu sedang dalam pertarungan!',
      'ALREADY_IN_COMBAT',
      { characterId }
    );
  }
}

// Cooldown-related errors
export class CooldownError extends GameError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, 'COOLDOWN', code, details);
  }

  static onCooldown(command: string, remainingTime: number): CooldownError {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    return new CooldownError(
      `⏰ Command masih dalam cooldown! Tunggu ${minutes}m ${seconds}s lagi.`,
      'ON_COOLDOWN',
      { command, remainingTime }
    );
  }
}

// Error handler class
export class ErrorHandler {
  static async handle(error: any, source: Message | ChatInputCommandInteraction) {
    // Log the error
    if (error instanceof GameError) {
      logger.warn(`${error.context} Error:`, {
        code: error.code,
        message: error.message,
        details: error.details
      });
    } else {
      logger.error('Unexpected Error:', error);
      logger.error('Stack:', error.stack);
    }

    // Get the error message
    let errorMessage = error instanceof Error ? error.message : '❌ Terjadi kesalahan yang tidak diketahui';
    
    // If it's a character creation message, don't treat it as an error in logs
    if (errorMessage.includes('a start') || errorMessage.includes('karakter')) {
      logger.info('User needs to create character:', errorMessage);
    }

    try {
      // Send error message to user
      if (source instanceof Message) {
        await source.reply({ 
          content: errorMessage,
          allowedMentions: { repliedUser: true }
        });
      } else {
        if (source.deferred) {
          await source.editReply({ content: errorMessage });
        } else {
          await source.reply({ 
            content: errorMessage, 
            ephemeral: true 
          });
        }
      }
    } catch (sendError) {
      logger.error('Error sending error message:', sendError);
    }
  }

  static isGameError(error: unknown): error is GameError {
    return error instanceof GameError;
  }

  static getErrorCode(error: unknown): string {
    if (error instanceof GameError) {
      return error.code;
    }
    return 'UNKNOWN_ERROR';
  }

  static getErrorContext(error: unknown): string {
    if (error instanceof GameError) {
      return error.context;
    }
    return 'UNKNOWN';
  }
} 