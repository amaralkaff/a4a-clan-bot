// src/commands/index.ts
export { default } from './commandList';
export * from './constants';

// Command cooldowns (in milliseconds)
export const COOLDOWNS = {
  hunt: 15000,      // 15 seconds
  battle: 30000,    // 30 seconds
  daily: 86400000,  // 24 hours
};

// Command descriptions for help
export const COMMAND_DESCRIPTIONS = {
  // Basic commands
  'help': '❓ Tampilkan panduan bermain',
  'p': '📊 Lihat profilmu',
  'h': '🗡️ Berburu monster (15s cd)',
  'd': '🎁 Hadiah harian (24h cd)',
  'i': '🎒 Lihat inventorymu',
  'u': '📦 Gunakan item',
  'b': '💰 Lihat uangmu',
  't': '⚔️ Latihan dengan mentor',
  'm': '🗺️ Lihat peta dunia',
  's': '🛍️ Buka toko'
}; 