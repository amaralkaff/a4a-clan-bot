// src/index.ts
import 'reflect-metadata';
import { Client, GatewayIntentBits } from 'discord.js';
import { CONFIG } from './config/config';
import { setupEventHandlers } from './events/eventHandler';
import { logger } from './utils/logger';
import { ServiceContainer } from './services/serviceContainer';

class A4AClanBot {
  private client: Client;
  private services: ServiceContainer;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
      ]
    });
    this.services = new ServiceContainer();
  }

  async start() {
    try {
      // Initialize services
      await this.services.init();

      // Setup event handlers
      await setupEventHandlers(this.client, this.services);

      // Login with retry mechanism
      let retries = 3;
      while (retries > 0) {
        try {
          await this.client.login(CONFIG.BOT_TOKEN);
          logger.info(`Logged in as ${this.client.user?.tag}`);
          logger.info('Bot is ready!');
          break;
        } catch (error) {
          retries--;
          if (retries === 0) {
            throw error;
          }
          logger.warn(`Login failed, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    } catch (error) {
      logger.error('Error starting bot:', error);
      await this.stop();
      process.exit(1);
    }
  }

  async stop() {
    try {
      await this.client.destroy();
      await this.services.cleanup();
      logger.info('Bot has been stopped');
    } catch (error) {
      logger.error('Error stopping bot:', error);
    }
  }
}

// Start the bot
const bot = new A4AClanBot();
bot.start().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down bot...');
  await bot.stop();
  process.exit(0);
});