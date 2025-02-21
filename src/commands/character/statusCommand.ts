import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags
  } from 'discord.js';
  import { CommandHandler } from '@/types/commands';
  import { createEphemeralReply } from '@/utils/helpers';
  import { StatusEffect, ActiveBuff, StatusEffects, ActiveBuffs } from '@/types/game';
  
  export const statusCommand: CommandHandler = {
    data: new SlashCommandBuilder()
      .setName('status')
      .setDescription('Tampilkan status karakter dan cuaca saat ini'),
  
    async execute(interaction, services) {
      try {
        const character = await services.character.getCharacterByDiscordId(interaction.user.id);
  
        if (!character) {
          return interaction.reply(createEphemeralReply({
            content: '❌ Kamu harus membuat karakter terlebih dahulu dengan command `/create`'
          }));
        }
  
        const stats = await services.character.getCharacterStats(character.id);
        const currentWeather = services.weather.getCurrentWeather();

        // Ensure status effects and buffs exist with default values
        const statusEffects: StatusEffects = stats.statusEffects || { effects: [] };
        const activeBuffs: ActiveBuffs = stats.activeBuffs || { buffs: [] };

        // Format status effects
        const statusEffectsText = statusEffects.effects?.length > 0 ?
          statusEffects.effects.map(effect => {
            let emoji = '';
            switch(effect.type) {
              case 'BURN': emoji = '🔥'; break;
              case 'POISON': emoji = '☠️'; break;
              case 'STUN': emoji = '⚡'; break;
              case 'HEAL_OVER_TIME': emoji = '💚'; break;
            }
            return `${emoji} ${effect.type}: ${effect.value} (${effect.duration} turn)`;
          }).join('\n') : 'Tidak ada';

        // Format active buffs
        const activeBuffsText = activeBuffs.buffs?.length > 0 ?
          activeBuffs.buffs.map(buff => {
            let emoji = '';
            switch(buff.type) {
              case 'ATTACK': emoji = '⚔️'; break;
              case 'DEFENSE': emoji = '🛡️'; break;
              case 'SPEED': emoji = '💨'; break;
              case 'ALL': emoji = '🌟'; break;
            }
            const timeLeft = Math.max(0, Math.floor((buff.expiresAt - Date.now()) / 1000));
            return `${emoji} ${buff.type}: +${buff.value} (${timeLeft}s)`;
          }).join('\n') : 'Tidak ada';
  
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
              name: '🌤️ Current Weather', 
              value: currentWeather.description,
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

        // Add status effects if any
        embed.addFields({
          name: '✨ Status Effects',
          value: statusEffectsText,
          inline: true
        });

        // Add active buffs if any
        embed.addFields({
          name: '⚡ Active Buffs',
          value: activeBuffsText,
          inline: true
        });

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