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
  
  export const data = new SlashCommandBuilder()
    .setName('explore')
    .setDescription('Exploration commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('map')
        .setDescription('Show current location and connected islands')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('sail')
        .setDescription('Sail to another island')
        .addStringOption(option =>
          option
            .setName('island')
            .setDescription('Island to sail to')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('search')
        .setDescription('Explore current island for events and items')
    );
  
  export async function execute(
    interaction: ChatInputCommandInteraction,
    prisma: PrismaClient
  ) {
    try {
      const explorationService = new ExplorationService(prisma);
      const battleService = new BattleService(prisma);
      const subcommand = interaction.options.getSubcommand();
  
      // Get character
      const character = await prisma.character.findFirst({
        where: {
          user: {
            discordId: interaction.user.id
          }
        }
      });
  
      if (!character) {
        return interaction.reply({
          content: 'Kamu harus membuat karakter terlebih dahulu dengan command `/create-character`',
          ephemeral: true
        });
      }
  
      switch (subcommand) {
        case 'map': {
          const currentIsland = character.currentIsland;
          const islandConfig = CONFIG.ISLANDS[currentIsland as keyof typeof CONFIG.ISLANDS];
          
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
          
          const sailResult = await explorationService.sail(character.id, targetIsland);
          
          let responseContent = `Berlayar dari ${sailResult.previousIsland} ke ${sailResult.newIsland}!\n\n`;
          
          if (sailResult.event.type === 'BATTLE') {
            const battleResult = await battleService.processBattle(
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
          
          const exploreResult = await explorationService.exploreIsland(character.id);
          
          let responseContent = `Mengeksplorasi ${exploreResult.location}...\n\n`;
          
          if (exploreResult.event.type === 'BATTLE') {
            const battleResult = await battleService.processBattle(
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
      logger.error('Error in exploration command:', error);
      return interaction.reply({
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ephemeral: true
      });
    }
  }