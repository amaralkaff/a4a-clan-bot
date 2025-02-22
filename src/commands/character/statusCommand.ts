import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags
  } from 'discord.js';
  import { CommandHandler } from '@/types/commands';
  import { createEphemeralReply } from '@/utils/helpers';

  export const statusCommand: CommandHandler = {
    data: new SlashCommandBuilder()
      .setName('status')
      .setDescription('Tampilkan status karaktermu'),
  
    async execute(interaction: ChatInputCommandInteraction, services) {
      try {
        const character = await services.character.getCharacterByDiscordId(interaction.user.id);
  
        if (!character) {
          return interaction.reply(createEphemeralReply({
            content: '❌ Kamu harus membuat karakter terlebih dahulu dengan `/start`'
          }));
        }
  
        const stats = await services.character.getCharacterStats(character.id);
  
        const embed = new EmbedBuilder()
          .setTitle(`📊 Status ${character.name}`)
          .setColor('#0099ff')
          .addFields(
            { 
              name: '📈 Level & Experience', 
              value: `📊 Level: ${stats.level}\n✨ EXP: ${stats.experience}/${stats.level * 1000}`,
              inline: true 
            },
            { 
              name: '❤️ Health', 
              value: `${stats.health}/${stats.maxHealth} HP`,
              inline: true 
            },
            { 
              name: '⚔️ Combat Stats', 
              value: `💪 Attack: ${stats.attack}\n🛡️ Defense: ${stats.defense}\n🔄 Combo: ${stats.combo}`,
              inline: true 
            },
            { 
              name: '🗺️ Location', 
              value: `🏝️ ${stats.location}`,
              inline: true 
            },
            {
              name: '📊 Progress',
              value: `🎯 Quest Points: ${stats.questPoints}\n🗺️ Exploration Points: ${stats.explorationPoints}`,
              inline: true
            }
          );
  
        // Add mentor progress if exists
        if (stats.mentor) {
          embed.addFields({
            name: '👥 Mentor Progress',
            value: `YB: ${stats.luffyProgress}%\nTierison: ${stats.zoroProgress}%\nLYuka: ${stats.usoppProgress}%\nGarryAng: ${stats.sanjiProgress}%`,
            inline: true
          });
        }
  
        // Add daily heal info if character has Sanji as mentor
        if (stats.mentor === 'GarryAng') {
          embed.addFields({
            name: '🍖 Daily Heal',
            value: `Used: ${stats.dailyHealCount}/3 times today`,
            inline: true
          });
        }
  
        // Add daily reset info
        if (stats.lastDailyReset) {
          const nextReset = new Date(stats.lastDailyReset);
          nextReset.setDate(nextReset.getDate() + 1);
          nextReset.setHours(0, 0, 0, 0);
          
          embed.addFields({
            name: '⏰ Daily Reset',
            value: `Next reset: ${nextReset.toLocaleTimeString()}`,
            inline: true
          });
        }
  
        return interaction.reply({ 
          embeds: [embed], 
          flags: MessageFlags.Ephemeral 
        });
      } catch (error) {
        services.logger.error('Error in status command:', error);
        return interaction.reply(createEphemeralReply({
          content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }));
      }
    }
  };