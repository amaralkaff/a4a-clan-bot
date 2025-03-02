// src/commands/constants.ts

// Command cooldowns (in milliseconds)
export const COOLDOWNS = {
  hunt: 15000,      // 15 seconds
  battle: 30000,    // 30 seconds
  daily: 86400000,  // 24 hours
  train: 300000,    // 5 minutes
  gamble: 10000,    // 10 seconds,
  duel: 60000,      // 1 minute
  quiz: 300000      // 5 minutes
};

// Command descriptions for help
export const COMMAND_DESCRIPTIONS = {
  // 👤 Character Commands
  'profile': '📊 Lihat status karaktermu (alias: a p)',
  'daily': '🎁 Klaim hadiah harian (alias: a d)',
  'balance': '💰 Cek uangmu (alias: a b)',
  'leaderboard': '🏆 Lihat ranking pemain (alias: a lb)',
  'give': '💸 Berikan uang ke pemain lain (contoh: a give @user 1000)',
  
  // ⚔️ Battle Commands
  'hunt': '⚔️ Berburu monster (alias: a h)',
  'duel': '⚔️ Tantang pemain lain untuk duel (contoh: a duel @user)',
  'accept': '✅ Terima tantangan duel',
  'reject': '❌ Tolak tantangan duel',
  
  // 🎒 Inventory & Equipment
  'inventory': '🎒 Lihat inventorymu (alias: a i)',
  'use': '📦 Gunakan item dari inventory (contoh: a use potion)',
  'equip': '🔧 Pakai equipment (contoh: a equip sword)',
  'unequip': '🔧 Lepas equipment (contoh: a unequip sword)',
  
  // 🗺️ Location & Shop
  'map': '🗺️ Lihat peta (alias: a m)',
  'shop': '🛍️ Buka toko (alias: a s)',
  'buy': '💰 Beli item dari toko (contoh: a buy potion 5)',
  
  // 📚 Training & Quiz
  'train': '📚 Berlatih dengan mentor (alias: a t)',
  'quiz': '📝 Ikuti quiz One Piece untuk hadiah (alias: a q)',
  
  // 🎰 Gambling
  'gamble': '🎰 Main game gambling (alias: a g)',
  'g slots': '🎰 Main slot machine (contoh: a g slots 1000)',
  'g help': '❓ Lihat panduan gambling'
}; 