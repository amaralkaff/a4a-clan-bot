// src/index.ts
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { CONFIG } from './config/config';
import { loadCommands } from './utils/commandLoader';
import { setupEventHandlers } from './events/eventHandler';
import { PrismaClient } from '@prisma/client';
import { WeatherService } from './services/WeatherService';
import { logger } from './utils/logger';
import { BotCommand } from './types/discord';
import { ServiceContainer, createServiceContainer } from './services';

class A4AClanBot {
  private client: Client;
  private prisma: PrismaClient;
  private services: ServiceContainer;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageReactions,
      ],
    });
    
    this.client.commands = new Collection<string, BotCommand>();
    this.prisma = new PrismaClient();
    this.services = createServiceContainer(this.prisma);
  }

  async start() {
    try {
      this.client.on('error', (error) => {
        logger.error('Discord client error:', error);
      });

      this.client.on('warn', (warning) => {
        logger.warn('Discord client warning:', warning);
      });

      this.client.on('debug', (info) => {
        logger.debug('Discord client debug:', info);
      });

      const commands = await loadCommands(this.client);
      (this.client as any).commands = commands;

      setupEventHandlers(this.client, this.services);

      await this.client.login(CONFIG.BOT_TOKEN);
      
      logger.info(`Logged in as ${this.client.user?.tag}`);
      logger.info('Bot is ready!');
    } catch (error) {
      logger.error('Error starting bot:', error);
      await this.stop();
      process.exit(1);
    }
  }

  async stop() {
    await this.prisma.$disconnect();
    this.client.destroy();
  }
}

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
});

const bot = new A4AClanBot();
bot.start();

process.on('SIGINT', async () => {
  logger.info('Shutting down bot...');
  await bot.stop();
  process.exit(0);
});