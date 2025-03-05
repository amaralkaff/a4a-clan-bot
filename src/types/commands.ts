// src/types/commands.ts
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    SlashCommandSubcommandsOnlyBuilder,
    SlashCommandOptionsOnlyBuilder,
    InteractionResponse,
    Message,
    InteractionReplyOptions
  } from 'discord.js';
  import { ServiceContainer } from '../services';
  import { PrismaClient } from '@prisma/client';
  
  // Main command handler interface
  export interface CommandHandler {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder;
    execute: (
      interaction: ChatInputCommandInteraction, 
      services: ServiceContainer
    ) => Promise<void | InteractionResponse<boolean> | Message<boolean>>;
  }
  
  // Type for interaction handlers
  export type InteractionHandler = (source: Message | ChatInputCommandInteraction) => Promise<unknown>;
  
  // Interface for character service commands
  export interface ICharacterCommands {
    handleProfile: InteractionHandler;
    handleBalance: InteractionHandler;
    handleHunt: InteractionHandler;
    handleDaily: InteractionHandler;
    handleHelp: InteractionHandler;
    handleSell: (source: Message | ChatInputCommandInteraction, args?: string[]) => Promise<unknown>;
    handleLeaderboard: (source: Message | ChatInputCommandInteraction, type?: string) => Promise<unknown>;
    handleStart: (source: Message | ChatInputCommandInteraction) => Promise<unknown>;
  }
  
  // Command cooldown configuration
  export const COMMAND_COOLDOWNS = {
    hunt: 5 * 60 * 1000, // 5 minutes
    daily: 24 * 60 * 60 * 1000, // 24 hours
    train: 30 * 60 * 1000, // 30 minutes
    duel: 10 * 60 * 1000, // 10 minutes
    gamble: 5 * 60 * 1000 // 5 minutes
  } as const;