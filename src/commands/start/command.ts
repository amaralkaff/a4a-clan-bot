import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('start')
  .setDescription('Mulai petualanganmu di dunia One Piece!')
  .addStringOption(option =>
    option
      .setName('name')
      .setDescription('Nama karaktermu')
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(20)
  )
  .addStringOption(option =>
    option
      .setName('mentor')
      .setDescription('Pilih mentormu')
      .setRequired(true)
      .addChoices(
        { name: 'YB - Spesialis Pertarungan Jarak Dekat', value: 'YB' },
        { name: 'Tierison - Spesialis Pedang', value: 'Tierison' },
        { name: 'LYuka - Spesialis Jarak Jauh', value: 'LYuka' },
        { name: 'GarryAng - Spesialis Pertarungan Kaki', value: 'GarryAng' }
      )
  ); 