import { ChatInputCommandInteraction } from 'discord.js';
import { ServiceContainer } from '@/services';
import { createEphemeralReply } from '@/utils/helpers';

export async function handleTraining(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  // Implementation will be added in MentorService
  return interaction.reply(createEphemeralReply({
    content: '🔄 Fitur dalam pengembangan...'
  }));
}