// src/types/commands.ts
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    SlashCommandSubcommandsOnlyBuilder,
    SlashCommandOptionsOnlyBuilder,
    InteractionResponse,
    Message
  } from 'discord.js';
  import { ServiceContainer } from '../services';
  
  export interface CommandHandler {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder;
    execute: (
      interaction: ChatInputCommandInteraction, 
      services: ServiceContainer
    ) => Promise<void | InteractionResponse<boolean> | Message<boolean>>;
  }

  export interface ICharacterService {
    handleProfile: (source: Message | ChatInputCommandInteraction) => Promise<unknown>;
    handleBalance: (source: Message | ChatInputCommandInteraction) => Promise<unknown>;
    handleHunt: (source: Message | ChatInputCommandInteraction) => Promise<unknown>;
    handleDaily: (source: Message | ChatInputCommandInteraction) => Promise<unknown>;
    handleHelp: (source: Message | ChatInputCommandInteraction) => Promise<unknown>;
    handleSell: (source: Message | ChatInputCommandInteraction, args?: string[]) => Promise<unknown>;
    handleLeaderboard: (source: Message | ChatInputCommandInteraction, type?: string) => Promise<unknown>;
    handleStart: (source: Message | ChatInputCommandInteraction) => Promise<unknown>;
  }