import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ServiceContainer } from '@/services';
import { createEphemeralReply } from '@/utils/helpers';

const NO_CHARACTER_MSG = '❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.';

export async function handleWallet(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  const character = await services.character.getCharacterByDiscordId(interaction.user.id);
  if (!character) {
    return interaction.reply(createEphemeralReply({
      content: NO_CHARACTER_MSG
    }));
  }

  const balance = await services.character.getBalance(character.id);
  const transactions = await services.character.getTransactionHistory(character.id, 5);

  const embed = new EmbedBuilder()
    .setTitle('💰 Dompetmu')
    .setColor('#ffd700')
    .addFields([
      { name: '💵 Uang Cash', value: `${balance.coins} coins`, inline: true },
      { name: '🏦 Bank', value: `${balance.bank} coins`, inline: true },
      { name: '💰 Total', value: `${balance.coins + balance.bank} coins`, inline: true }
    ]);

  // Add transaction history if exists
  if (transactions.length > 0) {
    const historyText = transactions.map(tx => {
      const amount = tx.amount > 0 ? `+${tx.amount}` : tx.amount;
      return `${tx.type}: ${amount} coins (${tx.description})`;
    }).join('\n');
    
    embed.addFields([
      { name: '📜 Riwayat Transaksi Terakhir', value: historyText }
    ]);
  }

  return interaction.reply({ embeds: [embed], ephemeral: true });
} 