import { ChatInputCommandInteraction, EmbedBuilder, Message } from 'discord.js';
import { ServiceContainer } from '@/services';
import { createEphemeralReply } from '@/utils/helpers';
import { getMentorEmoji } from './utils';

const NO_CHARACTER_MSG = '❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.';

async function createProfileEmbed(userId: string, services: ServiceContainer) {
  const character = await services.character.getCharacterByDiscordId(userId);
  
  if (!character) {
    return null;
  }

  const stats = await services.character.getCharacterStats(character.id);
  const balance = await services.character.getBalance(character.id);

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${character.name}'s Profile`)
    .setColor('#0099ff')
    .addFields(
      { 
        name: '📈 Level & Experience', 
        value: `Level: ${stats.level}\nEXP: ${stats.experience}/${stats.level * 1000}`,
        inline: true 
      },
      {
        name: '❤️ Health',
        value: `${stats.health}/${stats.maxHealth} HP`,
        inline: true
      },
      { 
        name: '💰 Balance', 
        value: `Coins: ${balance.coins}\nBank: ${balance.bank}`,
        inline: true 
      },
      { 
        name: '⚔️ Battle Stats', 
        value: `ATK: ${stats.attack}\nDEF: ${stats.defense}\nWins: ${stats.wins}\nLosses: ${stats.losses}\nStreak: ${stats.winStreak}`,
        inline: true 
      }
    );

  // Add mentor info if exists
  if (stats.mentor) {
    embed.addFields({
      name: '👨‍🏫 Mentor',
      value: `${getMentorEmoji(stats.mentor)} ${stats.mentor}`,
      inline: true
    });
  }

  return embed;
}

export async function handleProfileMessage(message: Message, services: ServiceContainer) {
  const embed = await createProfileEmbed(message.author.id, services);
  
  if (!embed) {
    return message.reply(NO_CHARACTER_MSG);
  }

  return message.reply({ embeds: [embed] });
}

export async function handleProfile(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  const embed = await createProfileEmbed(interaction.user.id, services);
  
  if (!embed) {
    return interaction.reply(createEphemeralReply({
      content: NO_CHARACTER_MSG
    }));
  }

  return interaction.reply({ embeds: [embed], ephemeral: true });
} 