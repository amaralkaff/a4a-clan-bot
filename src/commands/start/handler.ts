import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ServiceContainer } from '@/services';
import { MentorType } from '@/types/game';

export async function handleStart(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  try {
    const name = interaction.options.getString('name', true);
    const mentor = interaction.options.getString('mentor', true) as MentorType;

    // Check if character already exists
    const existingCharacter = await services.character.getCharacterByDiscordId(interaction.user.id);
    if (existingCharacter) {
      return interaction.reply({
        content: '❌ Kamu sudah memiliki karakter!',
        ephemeral: true
      });
    }

    // Create character
    const character = await services.character.createCharacter({
      discordId: interaction.user.id,
      name,
      mentor
    });

    // Create response embed
    const embed = new EmbedBuilder()
      .setTitle('✨ Karakter Berhasil Dibuat!')
      .setColor('#00ff00')
      .setDescription(`Selamat datang di dunia One Piece, ${character.name}!`)
      .addFields([
        { 
          name: '📊 Status Awal', 
          value: 
`Level: 1
HP: ${character.health}/${character.maxHealth}
ATK: ${character.attack}
DEF: ${character.defense}
Coins: ${character.coins}`,
          inline: true 
        },
        {
          name: '👨‍🏫 Mentor',
          value: `${getMentorEmoji(mentor)} ${mentor}`,
          inline: true
        }
      ])
      .setFooter({ text: 'Gunakan /help untuk melihat daftar command' });

    return interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error creating character:', error);
    return interaction.reply({
      content: '❌ Terjadi kesalahan saat membuat karakter. Silakan coba lagi.',
      ephemeral: true
    });
  }
}

function getMentorEmoji(mentor: MentorType): string {
  const emojis = {
    'YB': '🥊',
    'Tierison': '⚔️',
    'LYuka': '🎯',
    'GarryAng': '🦵'
  };
  return emojis[mentor];
} 