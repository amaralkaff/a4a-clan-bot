// src/index.ts
import 'reflect-metadata';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { CONFIG } from './config/config';
import { setupEventHandlers } from './events/eventHandler';
import { logger } from './utils/logger';
import { ServiceContainer, createServices } from './services';
import { loadCommands } from './utils/commandLoader';

class A4AClanBot {
  private client: Client;
  private services: ServiceContainer;
  private prisma: PrismaClient;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
      ],
      partials: [Partials.Channel]
    });

    this.prisma = new PrismaClient();
    this.services = createServices(this.prisma, this.client);
  }

  async start() {
    try {
      // Load commands
      await loadCommands(this.client);

      // Set up event handlers
      setupEventHandlers(this.client, this.services);

      // Login to Discord
      await this.client.login(CONFIG.BOT_TOKEN);
      logger.info('Bot is ready!');

    } catch (error) {
      logger.error('Error starting bot:', error);
      await this.stop();
      process.exit(1);
    }
  }

  async stop() {
    try {
      if (this.client) {
        this.client.destroy();
      }
      if (this.prisma) {
        await this.prisma.$disconnect();
      }
      logger.info('Bot stopped successfully');
    } catch (error) {
      logger.error('Error stopping bot:', error);
      process.exit(1);
    }
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  const bot = new A4AClanBot();
  await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  const bot = new A4AClanBot();
  await bot.stop();
  process.exit(0);
});

// Start the bot
const bot = new A4AClanBot();
bot.start().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
});