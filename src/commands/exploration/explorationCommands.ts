import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    EmbedBuilder 
  } from 'discord.js';
  import { PrismaClient } from '@prisma/client';
  import { ExplorationService } from '../../services/ExplorationService';
  import { BattleService } from '../../services/BattleService';
  import { CONFIG } from '../../config/config';
  import { logger } from '../../utils/logger';
  import { CommandHandler } from '@/types/commands';
  import { createEphemeralReply } from '@/utils/helpers';
  
  export const explorationCommands: CommandHandler = {
    data: new SlashCommandBuilder()
      .setName('explore')
      .setDescription('Sistem eksplorasi')
      .addSubcommand(subcommand =>
        subcommand
          .setName('map')
          .setDescription('Tampilkan lokasi saat ini dan pulau yang terhubung')
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('sail')
          .setDescription('Berlayar ke pulau lain')
          .addStringOption(option =>
            option
              .setName('island')
              .setDescription('Pulau tujuan')
              .setRequired(true)
              .addChoices(
                { name: 'Starter Island (Level 1)', value: 'Starter Island' },
                { name: 'Shell Town (Level 2)', value: 'Shell Town' },
                { name: 'Orange Town (Level 2)', value: 'Orange Town' },
                { name: 'Syrup Village (Level 3)', value: 'Syrup Village' },
                { name: 'Baratie (Level 4)', value: 'Baratie' }
              )
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('search')
          .setDescription('Jelajahi pulau saat ini untuk mencari event dan item')
      ),
  
    async execute(interaction, services) {
      try {
        const subcommand = interaction.options.getSubcommand();
  
        const character = await services.character.getCharacterByDiscordId(interaction.user.id);
  
        if (!character) {
          return interaction.reply(createEphemeralReply({
            content: 'Kamu harus membuat karakter terlebih dahulu dengan command `/create`'
          }));
        }
  
        switch (subcommand) {
          case 'map': {
            const currentIsland = character.currentIsland;
            const islandConfig = services.exploration.getIslandConfig(currentIsland);
            
            const embed = new EmbedBuilder()
              .setTitle('Peta Pelayaran')
              .setColor('#0099ff')
              .addFields(
                { name: 'Lokasi Saat Ini', value: currentIsland },
                { 
                  name: 'Pulau yang Terhubung', 
                  value: islandConfig.connections.join('\n') || 'Tidak ada'
                }
              )
              .setFooter({ text: `Level Pulau: ${islandConfig.level}` });
  
            return interaction.reply({ embeds: [embed], ephemeral: true });
          }
  
          case 'sail': {
            const targetIsland = interaction.options.getString('island', true);
            
            await interaction.deferReply({ ephemeral: true });
            
            const sailResult = await services.exploration.sail(character.id, targetIsland);
            
            let responseContent = `Berlayar dari ${sailResult.previousIsland} ke ${sailResult.newIsland}!\n\n`;
            
            if (sailResult.event.type === 'BATTLE') {
              const battleResult = await services.battle.processBattle(
                character.id,
                sailResult.event.data.enemyLevel
              );
              
              responseContent += `${sailResult.event.description}\n`;
              responseContent += battleResult.battleLog.join('\n');
              responseContent += `\n\n${battleResult.won ? 'Kamu memenangkan pertarungan!' : 'Kamu kalah dalam pertarungan!'}`;
            } else {
              responseContent += sailResult.event.description;
              if (sailResult.event.type === 'ITEM') {
                responseContent += `\nMendapatkan: ${sailResult.event.data.item.quantity}x ${sailResult.event.data.item.name}`;
              }
            }
  
            return interaction.editReply({ content: responseContent });
          }
  
          case 'search': {
            await interaction.deferReply({ ephemeral: true });
            
            const exploreResult = await services.exploration.exploreIsland(character.id);
            
            let responseContent = `Mengeksplorasi ${exploreResult.location}...\n\n`;
            
            if (exploreResult.event.type === 'BATTLE') {
              const battleResult = await services.battle.processBattle(
                character.id,
                exploreResult.event.data.enemyLevel
              );
              
              responseContent += `${exploreResult.event.description}\n`;
              responseContent += battleResult.battleLog.join('\n');
              responseContent += `\n\n${battleResult.won ? 'Kamu memenangkan pertarungan!' : 'Kamu kalah dalam pertarungan!'}`;
            } else {
              responseContent += exploreResult.event.description;
              if (exploreResult.event.type === 'ITEM') {
                responseContent += `\nMendapatkan: ${exploreResult.event.data.item.quantity}x ${exploreResult.event.data.item.name}`;
              }
            }
  
            return interaction.editReply({ content: responseContent });
          }
        }
      } catch (error) {
        services.logger.error('Error in exploration command:', error);
        return interaction.reply(createEphemeralReply({
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }));
      }
    }
  };