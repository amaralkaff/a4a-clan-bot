import { Client, Collection, REST, Routes, RESTPostAPIChatInputApplicationCommandsJSONBody, SlashCommandBuilder } from 'discord.js';
import { CONFIG } from '../config/config';
import { logger } from './logger';
import { CommandHandler } from '@/types/commands';

type LeaderboardType = 'level' | 'coins' | 'bank' | 'streak' | 'highstreak' | 'wins' | 'winrate' | 'gambled' | 'won';

// Define commands
export const commandList: { [key: string]: CommandHandler } = {
  start: {
    data: new SlashCommandBuilder()
      .setName('start')
      .setDescription('Buat karakter baru dan mulai petualanganmu')
      .setDMPermission(false)
      .setDefaultMemberPermissions(null),
    execute: async (interaction, services) => {
      await services.character.handleStart(interaction);
    }
  },
  profile: {
    data: new SlashCommandBuilder()
      .setName('profile')
      .setDescription('Lihat profil karaktermu')
      .setDMPermission(false)
      .setDefaultMemberPermissions(null),
    execute: async (interaction, services) => {
      await services.character.handleProfile(interaction);
    }
  },
  inventory: {
    data: new SlashCommandBuilder()
      .setName('inventory')
      .setDescription('Lihat inventorymu'),
    execute: async (interaction, services) => {
      await services.inventory.handleInventoryView(interaction);
    }
  },
  hunt: {
    data: new SlashCommandBuilder()
      .setName('hunt')
      .setDescription('Berburu monster untuk exp dan coins'),
    execute: async (interaction, services) => {
      await services.character.handleHunt(interaction);
    }
  },
  map: {
    data: new SlashCommandBuilder()
      .setName('map')
      .setDescription('Lihat lokasi yang tersedia'),
    execute: async (interaction, services) => {
      await services.location.handleMapView(interaction);
    }
  },
  help: {
    data: new SlashCommandBuilder()
      .setName('help')
      .setDescription('Lihat panduan dan daftar command'),
    execute: async (interaction, services) => {
      await services.help.handleHelp(interaction);
    }
  },
  daily: {
    data: new SlashCommandBuilder()
      .setName('daily')
      .setDescription('Klaim hadiah harian'),
    execute: async (interaction, services) => {
      await services.character.handleDaily(interaction);
    }
  },
  leaderboard: {
    data: new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Lihat peringkat pemain')
      .addStringOption(option =>
        option.setName('type')
          .setDescription('Jenis leaderboard')
          .setRequired(false)
          .addChoices(
            { name: 'Level', value: 'level' },
            { name: 'Coins', value: 'coins' },
            { name: 'Bank', value: 'bank' },
            { name: 'Streak', value: 'streak' },
            { name: 'Wins', value: 'wins' },
            { name: 'Winrate', value: 'winrate' }
          )),
    execute: async (interaction, services) => {
      const type = interaction.options.getString('type') as LeaderboardType || 'level';
      await services.leaderboard.handleLeaderboard(interaction, type);
    }
  },
  use: {
    data: new SlashCommandBuilder()
      .setName('use')
      .setDescription('Gunakan item dari inventorymu')
      .addStringOption(option =>
        option.setName('item')
          .setDescription('Item yang ingin digunakan')
          .setRequired(true)
          .setAutocomplete(true)),
    execute: async (interaction, services) => {
      const item = interaction.options.getString('item', true);
      await services.inventory.handleUseItem(interaction, item);
    }
  },
  sell: {
    data: new SlashCommandBuilder()
      .setName('sell')
      .setDescription('Jual item')
      .addStringOption(option =>
        option.setName('item')
          .setDescription('Item yang ingin dijual')
          .setRequired(true)
          .setAutocomplete(true))
      .addIntegerOption(option =>
        option.setName('quantity')
          .setDescription('Jumlah yang ingin dijual')
          .setRequired(false)
          .setMinValue(1)),
    execute: async (interaction, services) => {
      const item = interaction.options.getString('item', true);
      const quantity = interaction.options.getInteger('quantity') || 1;
      await services.inventory.handleSellItem(interaction, item, quantity);
    }
  },
  shop: {
    data: new SlashCommandBuilder()
      .setName('shop')
      .setDescription('Buka toko'),
    execute: async (interaction, services) => {
      await services.shop.handleShop(interaction);
    }
  },
  buy: {
    data: new SlashCommandBuilder()
      .setName('buy')
      .setDescription('Beli item dari toko')
      .addStringOption(option =>
        option.setName('item')
          .setDescription('Item yang ingin dibeli')
          .setRequired(true)
          .setAutocomplete(true))
      .addIntegerOption(option =>
        option.setName('quantity')
          .setDescription('Jumlah yang ingin dibeli')
          .setRequired(false)
          .setMinValue(1)),
    execute: async (interaction, services) => {
      const item = interaction.options.getString('item', true);
      const quantity = interaction.options.getInteger('quantity') || 1;
      await services.shop.handleBuyItem(interaction, item, quantity);
    }
  }
};

export async function loadCommands(client: Client): Promise<Collection<string, CommandHandler>> {
  const commandCollection = new Collection<string, CommandHandler>();
  const commandsArray: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

  for (const [name, command] of Object.entries(commandList)) {
    const cmd = command as CommandHandler;
    if ('data' in cmd && 'execute' in cmd) {
      logger.info(`Registering command: ${name}`);
      commandCollection.set(name, cmd);
      commandsArray.push(cmd.data.toJSON());
    } else {
      logger.warn(`Invalid command structure for ${name}`);
    }
  }

  try {
    const rest = new REST({ version: '10' }).setToken(CONFIG.BOT_TOKEN);

    // Log invite URL with admin permissions
    const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${CONFIG.CLIENT_ID}&permissions=8589934591&scope=bot%20applications.commands`;
    logger.info(`Bot invite URL: ${inviteUrl}`);

    logger.info('Started refreshing application (/) commands.');
    logger.info('Commands to register:', commandsArray.map(cmd => cmd.name).join(', '));

    // Register commands globally
    try {
      await rest.put(
        Routes.applicationCommands(CONFIG.CLIENT_ID),
        { body: commandsArray }
      );
      logger.info('Successfully registered global commands.');
    } catch (error: any) {
      logger.error('Failed to register global commands:', error);
      throw error;
    }

    return commandCollection;
  } catch (error) {
    logger.error('Error loading commands:', error);
    throw new Error('Failed to register Discord commands. Please check bot permissions and try again.');
  }
}