import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    EmbedBuilder 
  } from 'discord.js';
  import { CommandHandler } from '@/types/commands';
  import { createEphemeralReply } from '@/utils/helpers';
  
  export const statusCommand: CommandHandler = {
    data: new SlashCommandBuilder()
      .setName('status')
      .setDescription('Tampilkan status karakter dan cuaca saat ini'),
  
    async execute(interaction, services) {
      try {
        const character = await services.character.getCharacterByDiscordId(interaction.user.id);
  
        if (!character) {
          return interaction.reply(createEphemeralReply({
            content: 'Kamu harus membuat karakter terlebih dahulu dengan command `/create`'
          }));
        }
  
        const stats = await services.character.getCharacterStats(character.id);
        const currentWeather = services.weather.getCurrentWeather();
  
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
              currentWeather.effects.sailingSpeed < 1 
                ? '🚫 Sailing Speed Reduced' 
                : '✅ Normal Sailing Speed'
            }`
          });
  
        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        services.logger.error('Error in status command:', error);
        return interaction.reply(createEphemeralReply({
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }));
      }
    }
  };