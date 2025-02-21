import { Client, Events, Interaction, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { ServiceContainer } from '../services';

export function setupEventHandlers(client: Client, services: ServiceContainer) {
  client.once(Events.ClientReady, c => {
    logger.info(`Ready! Logged in as ${c.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isAutocomplete()) {
        const focusedValue = interaction.options.getFocused();
        if (interaction.commandName === 'quest' && interaction.options.getSubcommand() === 'complete') {
          const character = await services.character.getCharacterByDiscordId(interaction.user.id);
          if (!character) return;

          const activeQuests = await services.quest.getActiveQuests(character.id);
          const choices = activeQuests.map(quest => ({
            name: quest.name,
            value: quest.id
          }));

          await interaction.respond(
            choices.filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase()))
          );
        }
        return;
      }

      if (!interaction.isChatInputCommand()) return;

      const commandInteraction = interaction as ChatInputCommandInteraction;
      const command = (commandInteraction.client as any).commands.get(commandInteraction.commandName);

      if (!command) {
        logger.error(`No command matching ${commandInteraction.commandName} was found.`);
        await commandInteraction.reply({
          content: 'Maaf, command tersebut tidak ditemukan.',
          ephemeral: true
        });
        return;
      }

      logger.info(`Executing command: ${commandInteraction.commandName}`);
      
      await command.execute(commandInteraction, services);
      
      logger.info(`Command ${commandInteraction.commandName} executed successfully`);
    } catch (error) {
      logger.error('Error executing command:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      
      try {
        if (interaction.isChatInputCommand()) {
          const commandInteraction = interaction as ChatInputCommandInteraction;
          if (commandInteraction.replied || commandInteraction.deferred) {
            await commandInteraction.followUp({
              content: `Terjadi kesalahan saat menjalankan command!\nError: ${errorMessage}`,
              ephemeral: true
            });
          } else {
            await commandInteraction.reply({
              content: `Terjadi kesalahan saat menjalankan command!\nError: ${errorMessage}`,
              ephemeral: true
            });
          }
        }
      } catch (followUpError) {
        logger.error('Error sending error message:', followUpError);
      }
    }
  });

  // Handle errors
  client.on(Events.Error, error => {
    logger.error('Discord client error:', error);
  });

  client.on(Events.Warn, warning => {
    logger.warn('Discord client warning:', warning);
  });

  client.on(Events.Debug, info => {
    logger.debug('Discord client debug:', info);
  });
}