import { ChatInputCommandInteraction } from 'discord.js';
import { ServiceContainer } from '@/services';

export async function handleDaily(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  return services.character.handleDaily(interaction);
} 