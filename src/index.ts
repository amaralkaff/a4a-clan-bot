// src/index.ts
import 'reflect-metadata';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { CONFIG } from './config/config';
import { loadCommands } from './utils/commandLoader';
import { setupEventHandlers } from './events/eventHandler';
import { PrismaClient } from '@prisma/client';
import { logger } from './utils/logger';
import { createServices } from './services';
import { handleMessageCommand } from './commands/basic/handlers/index';

class A4AClanBot {
  private client: Client;
  private prisma: PrismaClient;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction],
      failIfNotExists: false
    });
    this.prisma = new PrismaClient();
  }

  async start() {
    try {
      // Setup error handlers first
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
      await setupEventHandlers(this.client, services);

      // Handle normal message commands
      const cooldowns = new Map();
      
      this.client.on('messageCreate', async (message) => {
        try {
          // Ignore bot messages
          if (message.author.bot) return;

          // Check for prefix 'a'
          if (!message.content.toLowerCase().startsWith('a ')) return;

          const args = message.content.slice(2).trim().split(/ +/);
          const command = args.shift()?.toLowerCase();

          if (!command) return;

          // Check cooldown
          const cooldownAmount = 3000; // 3 seconds
          const now = Date.now();
          const timestamps = cooldowns.get(message.author.id);
          
          if (timestamps) {
            const expirationTime = timestamps + cooldownAmount;
            if (now < expirationTime) {
              const timeLeft = (expirationTime - now) / 1000;
              return message.reply(`⏳ Mohon tunggu ${timeLeft.toFixed(1)} detik sebelum menggunakan command lagi.`);
            }
          }

          cooldowns.set(message.author.id, now);
          setTimeout(() => cooldowns.delete(message.author.id), cooldownAmount);

          // Add loading message
          let reply;
          try {
            reply = await message.reply('⌛ Processing your command...');
          } catch (error) {
            logger.error('Failed to send loading message:', error);
            return;
          }

          try {
            await handleMessageCommand(message, services, command, args);
            
            // Delete loading message on success
            try {
              await reply.delete();
            } catch (error) {
              logger.warn('Failed to delete loading message:', error);
            }
          } catch (error) {
            logger.error('Command execution error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            try {
              await reply.edit(`❌ Error: ${errorMessage}`);
            } catch (editError) {
              logger.error('Failed to edit error message:', editError);
              try {
                await message.channel.send(`❌ Error: ${errorMessage}`);
              } catch (sendError) {
                logger.error('Failed to send error message:', sendError);
              }
            }
          }
        } catch (error) {
          logger.error('Message handling error:', error);
          try {
            await message.reply('❌ Terjadi kesalahan internal');
          } catch (replyError) {
            logger.error('Failed to send error message:', replyError);
          }
        }
      });

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