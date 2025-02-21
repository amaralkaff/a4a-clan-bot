// src/types/commands.ts
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    SlashCommandSubcommandsOnlyBuilder
  } from 'discord.js';
  import { ServiceContainer } from '../services';
  
  export interface CommandHandler {
    data: SlashCommandBuilder | Omit<SlashCommandBuilder, "addSubcommandGroup" | "addSubcommand">;
    execute: (
      interaction: ChatInputCommandInteraction, 
      services: ServiceContainer
    ) => Promise<any>;
  }