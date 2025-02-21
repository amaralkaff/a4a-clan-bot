import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags
  } from 'discord.js';
  import { CommandHandler } from '@/types/commands';
  import { ServiceContainer } from '@/services';
  import { createEphemeralReply } from '@/utils/helpers';
  import { LOCATIONS } from '@/config/gameData';
  import { LocationId } from '@/types/game';
  
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
                { name: 'Starter Island (Level 1) - Pulau Pemula', value: 'starter_island' },
                { name: 'Shell Town (Level 2) - Kota Marinir', value: 'shell_town' },
                { name: 'Orange Town (Level 2) - Kota Buggy', value: 'orange_town' },
                { name: 'Syrup Village (Level 3) - Desa Usopp', value: 'syrup_village' },
                { name: 'Baratie (Level 4) - Restoran Laut', value: 'baratie' }
              )
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('search')
          .setDescription('Jelajahi pulau saat ini untuk mencari event dan item')
      ),
  
    async execute(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
      try {
        const subcommand = interaction.options.getSubcommand();
  
        const character = await services.character.getCharacterByDiscordId(interaction.user.id);
  
        if (!character) {
          return interaction.reply(createEphemeralReply({
            content: '❌ Kamu harus membuat karakter terlebih dahulu dengan command `/create`'
          }));
        }
  
        // Defer reply for all subcommands since they might take time
        await interaction.deferReply({ 
          ephemeral: true 
        });
  
        try {
          switch (subcommand) {
            case 'map': {
              const currentIsland = character.currentIsland as LocationId;
              const islandConfig = services.exploration.getIslandConfig(currentIsland);
              
              const embed = new EmbedBuilder()
                .setTitle('🗺️ Peta Pelayaran')
                .setColor('#0099ff')
                .addFields(
                  { 
                    name: '📍 Lokasi Saat Ini', 
                    value: `${LOCATIONS[currentIsland].name} (Level ${LOCATIONS[currentIsland].level})`
                  },
                  { 
                    name: '🏝️ Pulau yang Terhubung', 
                    value: islandConfig.connections.map(id => 
                      `${LOCATIONS[id as LocationId].name} (Level ${LOCATIONS[id as LocationId].level})`
                    ).join('\n') || 'Tidak ada'
                  }
                )
                .setFooter({ text: `Level Pulau Saat Ini: ${islandConfig.level}` });
  
              return interaction.editReply({ 
                embeds: [embed]
              });
            }
  
            case 'sail': {
              const targetIsland = interaction.options.getString('island', true) as LocationId;
              
              // Check if character meets level requirement
              if (character.level < LOCATIONS[targetIsland].level) {
                return interaction.editReply({
                  content: `❌ Level kamu (${character.level}) tidak cukup untuk ke ${LOCATIONS[targetIsland].name} (Required: Level ${LOCATIONS[targetIsland].level})`
                });
              }
              
              const sailResult = await services.exploration.sail(character.id, targetIsland);

              // Add sailing buffs based on weather
              if (sailResult.event.type === 'WEATHER') {
                switch (sailResult.event.description) {
                  case 'windy':
                    // Bonus speed in windy weather
                    await services.character.addBuff(character.id, {
                      type: 'SPEED',
                      value: 5,
                      expiresAt: Date.now() + (900 * 1000) // 15 minutes
                    });
                    break;
                  case 'stormy':
                    // Defense buff in stormy weather
                    await services.character.addBuff(character.id, {
                      type: 'DEFENSE',
                      value: 10,
                      expiresAt: Date.now() + (1800 * 1000) // 30 minutes
                    });
                    break;
                }
              }

              return interaction.editReply({ embeds: [sailResult.embed] });
            }
  
            case 'search': {
              const exploreResult = await services.exploration.exploreLocation(character.id);

              // Add exploration effects based on location and findings
              if (exploreResult.items.length > 0) {
                // Found rare items, add temporary buff
                await services.character.addBuff(character.id, {
                  type: 'ALL',
                  value: 3,
                  expiresAt: Date.now() + (1800 * 1000) // 30 minutes
                });
              }

              // Add location-specific effects
              switch (character.currentIsland) {
                case 'baratie':
                  // Healing effect in Baratie
                  await services.character.addStatusEffect(character.id, {
                    type: 'HEAL_OVER_TIME',
                    value: 5,
                    duration: 3
                  });
                  break;
                case 'syrup_village':
                  // Usopp's village gives defense buff
                  await services.character.addBuff(character.id, {
                    type: 'DEFENSE',
                    value: 5,
                    expiresAt: Date.now() + (3600 * 1000) // 1 hour
                  });
                  break;
                case 'shell_town':
                  // Marine training ground gives attack buff
                  await services.character.addBuff(character.id, {
                    type: 'ATTACK',
                    value: 5,
                    expiresAt: Date.now() + (3600 * 1000) // 1 hour
                  });
                  break;
              }

              return interaction.editReply({ embeds: [exploreResult.embed] });
            }
  
            default: {
              return interaction.editReply({
                content: '❌ Subcommand tidak valid'
              });
            }
          }
        } catch (error) {
          // Handle specific errors
          if (error instanceof Error) {
            if (error.message.includes('Lokasi tidak valid')) {
              return interaction.editReply({
                content: '❌ Lokasi yang dipilih tidak valid'
              });
            }
            if (error.message.includes('Tidak dapat berlayar')) {
              return interaction.editReply({
                content: '❌ Tidak dapat berlayar ke lokasi tersebut secara langsung. Gunakan `/explore map` untuk melihat rute yang tersedia.'
              });
            }
          }
          throw error; // Re-throw untuk error handling global
        }
      } catch (error) {
        services.logger.error('Error in exploration command:', error);
        
        // If reply was deferred, use editReply
        if (interaction.deferred) {
          return interaction.editReply({
            content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
        
        // Otherwise use normal reply
        return interaction.reply(createEphemeralReply({
          content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }));
      }
    }
  };