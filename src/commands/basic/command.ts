// src/commands/basic/command.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('a')
  .setDescription('A4A CLAN BOT - One Piece RPG')
  // Character Commands
  .addSubcommand(subcommand =>
    subcommand
      .setName('p')
      .setDescription('📊 Lihat profilmu')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('d')
      .setDescription('🎁 Klaim hadiah harian')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('b')
      .setDescription('💰 Cek uangmu')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('lb')
      .setDescription('🏆 Lihat ranking pemain')
      .addStringOption(option =>
        option
          .setName('kategori')
          .setDescription('Pilih kategori leaderboard')
          .setRequired(false)
          .addChoices(
            { name: 'Level Tertinggi', value: 'level' },
            { name: 'Total Kemenangan', value: 'wins' },
            { name: 'Total Kekayaan', value: 'coins' },
            { name: 'Win Streak Saat Ini', value: 'winStreak' },
            { name: 'Win Streak Tertinggi', value: 'highestStreak' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('give')
      .setDescription('💸 Berikan uang ke pemain lain')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('Pilih pemain yang akan diberi uang')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('amount')
          .setDescription('Jumlah uang yang akan diberikan')
          .setRequired(true)
          .setMinValue(1)
      )
  )
  // Battle Commands
  .addSubcommand(subcommand =>
    subcommand
      .setName('h')
      .setDescription('⚔️ Berburu monster')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('duel')
      .setDescription('⚔️ Tantang pemain lain untuk duel')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('Pilih pemain yang akan ditantang')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('accept')
      .setDescription('✅ Terima tantangan duel')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('reject')
      .setDescription('❌ Tolak tantangan duel')
  )
  // Inventory & Equipment
  .addSubcommand(subcommand =>
    subcommand
      .setName('i')
      .setDescription('🎒 Lihat inventorymu')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('u')
      .setDescription('📦 Gunakan item dari inventory')
      .addStringOption(option =>
        option
          .setName('item')
          .setDescription('Pilih item yang ingin digunakan')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('sell')
      .setDescription('💰 Jual item dari inventory')
      .addStringOption(option =>
        option
          .setName('item')
          .setDescription('Nama item yang ingin dijual')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('amount')
          .setDescription('Jumlah item yang ingin dijual')
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('equip')
      .setDescription('🔧 Pakai equipment')
      .addStringOption(option =>
        option
          .setName('item')
          .setDescription('Pilih equipment yang ingin dipakai')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('unequip')
      .setDescription('🔧 Lepas equipment')
      .addStringOption(option =>
        option
          .setName('item')
          .setDescription('Pilih equipment yang ingin dilepas')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  // Location & Shop
  .addSubcommand(subcommand =>
    subcommand
      .setName('m')
      .setDescription('🗺️ Lihat peta')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('s')
      .setDescription('🛍️ Buka toko')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('buy')
      .setDescription('💰 Beli item dari toko')
      .addStringOption(option =>
        option
          .setName('item')
          .setDescription('Nama item yang ingin dibeli')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addIntegerOption(option =>
        option
          .setName('amount')
          .setDescription('Jumlah yang ingin dibeli')
          .setRequired(false)
          .setMinValue(1)
      )
  )
  // Training & Quiz
  .addSubcommand(subcommand =>
    subcommand
      .setName('t')
      .setDescription('📚 Berlatih dengan mentor')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('q')
      .setDescription('📝 Ikuti quiz One Piece untuk hadiah')
  )
  // Gambling
  .addSubcommandGroup(group => 
    group
      .setName('gamble')
      .setDescription('🎰 Gambling commands')
      .addSubcommand(subcommand =>
        subcommand
          .setName('slots')
          .setDescription('🎰 Main slot machine')
          .addIntegerOption(option =>
            option
              .setName('amount')
              .setDescription('Jumlah taruhan (default: 100)')
              .setMinValue(100)
              .setMaxValue(50000)
              .setRequired(false)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('help')
          .setDescription('❓ Lihat panduan gambling')
      )
  ); 