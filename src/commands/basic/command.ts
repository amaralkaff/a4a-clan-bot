// src/commands/basic/command.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('a')
  .setDescription('A4A CLAN BOT - One Piece RPG')
  .addSubcommand(subcommand =>
    subcommand
      .setName('p')
      .setDescription('📊 Lihat profilmu')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('h')
      .setDescription('🗡️ Berburu monster (15s cooldown)')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('d')
      .setDescription('🎁 Hadiah harian')
  )
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
      .setName('b')
      .setDescription('💰 Lihat uangmu')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('t')
      .setDescription('⚔️ Latihan dengan mentor')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('m')
      .setDescription('🗺️ Lihat peta dunia')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('s')
      .setDescription('🛍️ Buka toko')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('lb')
      .setDescription('👑 Lihat leaderboard')
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
  ); 