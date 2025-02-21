import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    EmbedBuilder 
  } from 'discord.js';
  import { PrismaClient } from '@prisma/client';
  import { CharacterService } from '../../services/CharacterService';
  import { WeatherService } from '../../services/WeatherService';
  import { logger } from '../../utils/logger';
  
  export const data = new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show character status and current weather');
  
  export async function execute(
    interaction: ChatInputCommandInteraction,
    prisma: PrismaClient
  ) {
    try {
      const characterService = new CharacterService(prisma);
      const weatherService = new WeatherService();
  
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
  
      const stats = await characterService.getCharacterStats(character.id);
      const currentWeather = weatherService.getCurrentWeather();
  
      const embed = new EmbedBuilder()
        .setTitle(`Status ${character.name}`)
        .setColor('#0099ff')
        .addFields(
          { 
            name: 'Level & Experience', 
            value: `Level: ${stats.level}\nEXP: ${stats.experience}/${stats.level * 1000}`,
            inline: true 
          },
          { 
            name: 'Health', 
            value: `${stats.health}/${stats.maxHealth} HP`,
            inline: true 
          },
          { 
            name: 'Combat Stats', 
            value: `Attack: ${stats.attack}\nDefense: ${stats.defense}`,
            inline: true 
          },
          { 
            name: 'Location', 
            value: stats.location,
            inline: true 
          },
          { 
            name: 'Current Weather', 
            value: currentWeather.description,
            inline: true 
          }
        )
        .setFooter({ 
          text: `Weather Effects: ${
            currentWeather.effects.sailingSpeed && currentWeather.effects.sailingSpeed < 1 
              ? '🚫 Sailing Speed Reduced' 
              : '✅ Normal Sailing Speed'
          }`
        });
  
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      logger.error('Error in status command:', error);
      return interaction.reply({
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ephemeral: true
      });
    }
  }