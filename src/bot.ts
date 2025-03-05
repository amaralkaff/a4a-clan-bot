import { Client, GatewayIntentBits, Events, Partials } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { createServices } from './services';
import { handleMessageCommand } from './utils/messageHandler';
import { logger } from './utils/logger';
import { loadCommands } from './utils/commandLoader';
import { CONFIG } from './config/config';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const prisma = new PrismaClient();

async function main() {
  try {
    // Initialize services
    const services = createServices(prisma, client);

    // Load commands
    const commands = await loadCommands(client);

    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const command = commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, services);
      } catch (error) {
        logger.error('Error executing command:', error);
        const content = error instanceof Error ? error.message : 'An error occurred while executing this command.';
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content, ephemeral: true });
        } else {
          await interaction.reply({ content, ephemeral: true });
        }
      }
    });

    client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;
      await handleMessageCommand(message, services);
    });

    // Login to Discord
    await client.login(CONFIG.BOT_TOKEN);
    logger.info('Bot is ready!');

  } catch (error) {
    logger.error('Error in main:', error);
    process.exit(1);
  }
}

main(); 