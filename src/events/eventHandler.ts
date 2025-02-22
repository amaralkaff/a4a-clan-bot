import { Client, Events, Interaction, ChatInputCommandInteraction, AutocompleteInteraction, MessageFlags } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { ServiceContainer } from '@/services';
import { basicCommands } from '@/commands/basic';

interface Quest {
  id: string;
  name: string;
  description: string;
  reward: number;
  status: string;
  characterId: string;
}

export function setupEventHandlers(client: Client, services: ServiceContainer) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      // Handle simplified commands
      if (interaction.commandName === 'a') {
        await basicCommands.execute(interaction, services);
        return;
      }

      logger.warn(`Unknown command: ${interaction.commandName}`);
      await interaction.reply({ 
        content: '❌ Command tidak ditemukan!',
        ephemeral: true 
      });
    } catch (error) {
      logger.error('Error executing command:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: `❌ Error: ${errorMessage}`,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `❌ Error: ${errorMessage}`,
          ephemeral: true
        });
      }
    }
  });

  client.on(Events.ClientReady, () => {
    logger.info(`Logged in as ${client.user?.tag}`);
  });

  client.on(Events.Error, (error) => {
    logger.error('Discord client error:', error);
  });

  client.on(Events.Warn, warning => {
    logger.warn('Discord client warning:', warning);
  });

  client.on(Events.Debug, info => {
    logger.debug('Discord client debug:', info);
  });
}