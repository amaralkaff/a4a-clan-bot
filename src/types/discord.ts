// src/types/discord.ts
import { 
  Collection, 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  MessageFlags
} from 'discord.js';
import { PrismaClient } from '@prisma/client';

// Interface untuk Command
export interface BotCommand {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction, prisma: PrismaClient) => Promise<void>;
}

// Helper function untuk ephemeral replies
export const createEphemeralReply = (options: Omit<InteractionReplyOptions, 'flags'>): InteractionReplyOptions => ({
  ...options,
  flags: MessageFlags.Ephemeral
});

// Type augmentation untuk Discord.js Client
declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, BotCommand>;
  }
}