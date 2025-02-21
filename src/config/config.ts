// src/config/config.ts
import { config } from 'dotenv';
import { logger } from '../utils/logger';

config();

// Validasi environment variables
const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID'] as const;
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Generate Bot Invite URL
const OAUTH2_SCOPES = [
  'bot',
  'applications.commands'
];

// Permissions yang diperlukan:
// - View Channels (1 << 10)
// - Send Messages (1 << 11)
// - Embed Links (1 << 14)
// - Read Message History (1 << 16)
// - Use Application Commands (1 << 31)
const PERMISSION_INTEGER = '2147485760';

const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=${PERMISSION_INTEGER}&scope=${OAUTH2_SCOPES.join('%20')}`;

logger.info(`Bot invite URL: ${inviteUrl}`);

export const CONFIG = {
  BOT_TOKEN: process.env.DISCORD_TOKEN!,
  CLIENT_ID: process.env.CLIENT_ID!,
  GUILD_ID: process.env.GUILD_ID!,
  INVITE_URL: inviteUrl,
  
  // Game Config
  STARTER_STATS: {
    HEALTH: 100 as number,
    ATTACK: 10 as number,
    DEFENSE: 10 as number,
  },
  
  // Map Config
  ISLANDS: {
    'Starter Island': {
      connections: ['Shell Town', 'Orange Town'],
      level: 1,
    },
    'Shell Town': {
      connections: ['Starter Island', 'Orange Town'],
      level: 2,
    },
  },
  
  // Battle Config
  BATTLE: {
    MIN_DAMAGE: 5,
    CRIT_CHANCE: 0.1,
    CRIT_MULTIPLIER: 1.5,
  },
  
  // Weather System
  WEATHER_TYPES: ['SUNNY', 'RAINY', 'STORMY'] as const,
  WEATHER_CHANGE_INTERVAL: 1000 * 60 * 30, // 30 menit
} as const;

// Validasi token ada dan tidak kosong
if (!CONFIG.BOT_TOKEN || CONFIG.BOT_TOKEN.length < 50) {
  throw new Error('Discord token is missing or invalid');
}

// Validasi ID format
if (!/^\d{17,19}$/.test(CONFIG.CLIENT_ID) || !/^\d{17,19}$/.test(CONFIG.GUILD_ID)) {
  throw new Error('Invalid Discord ID format for CLIENT_ID or GUILD_ID');
}

logger.info('Configuration loaded successfully');