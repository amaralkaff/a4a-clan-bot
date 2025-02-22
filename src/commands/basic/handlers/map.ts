import { ChatInputCommandInteraction } from 'discord.js';
import { ServiceContainer } from '@/services';

export async function handleMapView(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  return services.location.handleMapView(interaction);
}