// src/index.ts
import { Client, GatewayIntentBits } from 'discord.js';
import { CONFIG } from './config/config';
import { loadCommands } from './utils/commandLoader';
import { setupEventHandlers } from './events/eventHandler';
import { PrismaClient } from '@prisma/client';
import { logger } from './utils/logger';
import { createServices } from './services';

class A4AClanBot {
  private client: Client;
  private prisma: PrismaClient;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
      ]
    });
    this.prisma = new PrismaClient();
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

      const services = createServices(this.prisma);

      // Handle normal message commands
      this.client.on('messageCreate', async (message) => {
        // Ignore bot messages
        if (message.author.bot) return;

        // Check for prefix 'a'
        if (!message.content.toLowerCase().startsWith('a ')) return;

        const args = message.content.slice(2).trim().split(/ +/);
        const command = args.shift()?.toLowerCase();

        if (!command) return;

        try {
          switch(command) {
            case 'p':
            case 'profile':
              await services.character.handleProfile(message);
              break;
            case 'h':
            case 'hunt':
              await services.character.handleHunt(message);
              break;
            case 'd':
            case 'daily':
              await services.character.handleDaily(message);
              break;
            case 'i':
            case 'inv':
              await services.character.handleInventory(message);
              break;
            case 'u':
            case 'use':
              await services.inventory.handleUseItem(message, args[0]);
              break;
            case 'b':
            case 'bal':
              await services.character.handleBalance(message);
              break;
            case 't':
            case 'train':
              await services.mentor.handleTraining(message);
              break;
            case 'm':
            case 'map':
              await services.location.handleMap(message);
              break;
            case 's':
            case 'shop':
              await services.shop.handleShop(message);
              break;
            case 'help':
              await services.character.handleHelp(message);
              break;
            default:
              await message.reply('❌ Command tidak ditemukan! Gunakan `a help` untuk melihat daftar command.');
          }
        } catch (error) {
          logger.error('Error executing command:', error);
          await message.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

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
    try {
      await this.client.destroy();
      await this.prisma.$disconnect();
      logger.info('Bot stopped successfully');
    } catch (error) {
      logger.error('Error stopping bot:', error);
    }
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