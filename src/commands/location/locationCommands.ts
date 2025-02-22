// src/commands/location/locationCommands.ts
import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { CommandHandler } from '@/types/commands';
import { LocationId } from '@/types/game';
import { createEphemeralReply } from '@/utils/helpers';

const VALID_LOCATIONS: LocationId[] = [
  'foosha',
  'syrup_village',
  'baratie',
  'arlong_park',
  'loguetown',
  'drum_island',
  'cocoyashi'
];

export const locationCommands: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('location')
    .setDescription('Perintah terkait lokasi')
    .addSubcommand(subcommand =>
      subcommand
        .setName('travel')
        .setDescription('Berpindah ke lokasi lain')
        .addStringOption(option =>
          option
            .setName('destination')
            .setDescription('Lokasi tujuan')
            .setRequired(true)
            .addChoices(
              { name: 'Foosha Village', value: 'foosha' },
              { name: 'Syrup Village', value: 'syrup_village' },
              { name: 'Baratie', value: 'baratie' },
              { name: 'Arlong Park', value: 'arlong_park' },
              { name: 'Loguetown', value: 'loguetown' },
              { name: 'Drum Island', value: 'drum_island' },
              { name: 'Cocoyashi Village', value: 'cocoyashi' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Informasi tentang lokasi saat ini')
    ),

  async execute(interaction: ChatInputCommandInteraction, services) {
    try {
      const character = await services.character.getCharacterByDiscordId(interaction.user.id);
      
      if (!character) {
        return interaction.reply(createEphemeralReply({
          content: '❌ Kamu harus membuat karakter terlebih dahulu dengan `/start`'
        }));
      }

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'travel') {
        const destination = interaction.options.getString('destination', true) as LocationId;
        
        if (!VALID_LOCATIONS.includes(destination)) {
          return interaction.reply(createEphemeralReply({
            content: '❌ Lokasi tidak valid'
          }));
        }

        const result = await services.location.travel(character.id, destination);
        
        if (!result.success) {
          return interaction.reply(createEphemeralReply({
            content: `❌ ${result.message}`
          }));
        }

        const embed = new EmbedBuilder()
          .setTitle('🗺️ Perjalanan Berhasil!')
          .setDescription(`Kamu telah tiba di ${destination.replace('_', ' ')}`)
          .setColor('#00ff00');

        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'info') {
        const stats = await services.character.getCharacterStats(character.id);
        const locationInfo = await services.location.getLocationInfo(stats.location as LocationId);

        const embed = new EmbedBuilder()
          .setTitle(`🗺️ ${stats.location.replace('_', ' ')}`)
          .setDescription(locationInfo.description)
          .addFields(
            { 
              name: '📍 Level Rekomendasi', 
              value: `${locationInfo.recommendedLevel}+`,
              inline: true 
            },
            {
              name: '💰 Drop Rate',
              value: `${locationInfo.dropRate}x`,
              inline: true
            },
            {
              name: '⚔️ Monster Level',
              value: `${locationInfo.monsterLevel}`,
              inline: true
            }
          )
          .setColor('#0099ff');

        return interaction.reply({ embeds: [embed] });
      }
    } catch (error) {
      services.logger.error('Error in location command:', error);
      return interaction.reply(createEphemeralReply({
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    }
  }
}; 