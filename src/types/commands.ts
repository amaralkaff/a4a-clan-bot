// src/types/commands.ts
import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction 
  } from 'discord.js';
  import { ServiceContainer } from '../services';
  
  export interface CommandHandler {
    data: SlashCommandBuilder;
    execute: (
      interaction: ChatInputCommandInteraction, 
      services: ServiceContainer
    ) => Promise<void>;
  }