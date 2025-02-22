// src/commands/constants.ts

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
  'start': '🎮 Mulai petualanganmu',
  'profile': '📊 Lihat status karaktermu',
  'daily': '🎁 Klaim hadiah harian',
  
  // Adventure commands
  'hunt': '🗡️ Berburu monster untuk EXP dan item (15s cooldown)',
  'battle': '⚔️ Bertarung dengan monster (30s cooldown)',
  
  // Basic features
  'inventory': '🎒 Lihat dan gunakan item',
  'shop': '🛍️ Beli item dan equipment',
  'quest': '📜 Lihat dan ambil quest',
  
  // Mentor interaction
  'train': '👥 Berlatih dengan mentormu',
  
  // Location
  'map': '🗺️ Lihat peta dan lokasi',
  'travel': '⛵ Pergi ke pulau lain'
}; 