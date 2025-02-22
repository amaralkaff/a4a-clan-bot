import { ChatInputCommandInteraction } from 'discord.js';
import { ServiceContainer } from '@/services';

export async function handleHunt(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  return services.character.handleHunt(interaction);
}