import { Client, Events, Interaction, ChatInputCommandInteraction, AutocompleteInteraction, MessageFlags } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { ServiceContainer } from '@/services';
import { commandList } from '@/commands/commandList';

interface Quest {
  id: string;
  name: string;
  description: string;
  reward: number;
  status: string;
  characterId: string;
}

export async function setupEventHandlers(client: Client, services: ServiceContainer) {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        const command = commandList[interaction.commandName];
        if (!command) {
          return interaction.reply({
            content: '❌ Command tidak ditemukan!',
            ephemeral: true
          });
        }

        try {
          await command.execute(interaction, services);
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
      }
      
      // Handle autocomplete interactions
      if (interaction.isAutocomplete()) {
        try {
          const command = interaction.commandName;
          const subcommand = interaction.options.getSubcommand();
          const focusedOption = interaction.options.getFocused(true);

          if (command === 'a' && subcommand === 'u' && focusedOption.name === 'item') {
            const choices = await services.inventory.getItemChoices(interaction.user.id);
            await interaction.respond(choices);
          }
        } catch (error) {
          logger.error('Error handling autocomplete:', error);
        }
      }
    } catch (error) {
      logger.error('Error handling interaction:', error);
    }
  });

  // Handle rate limits
  client.on('rateLimit', (rateLimitInfo) => {
    logger.warn('Rate limit hit:', rateLimitInfo);
  });

  client.on(Events.ClientReady, () => {
    logger.info(`Logged in as ${client.user?.tag}`);
    logger.info('Bot is ready!');
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

  // Handle guild join
  client.on(Events.GuildCreate, guild => {
    logger.info(`Joined new guild: ${guild.name} (${guild.id})`);
  });

  // Handle guild leave
  client.on(Events.GuildDelete, guild => {
    logger.info(`Left guild: ${guild.name} (${guild.id})`);
  });
}