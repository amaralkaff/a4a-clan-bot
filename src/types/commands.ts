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