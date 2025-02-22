import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ServiceContainer } from '@/services';
import { createEphemeralReply } from '@/utils/helpers';
import { getItemTypeEmoji } from './utils';

const NO_CHARACTER_MSG = '❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.';

export async function handleShopView(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  const character = await services.character.getCharacterByDiscordId(interaction.user.id);
  if (!character) {
    return interaction.reply(createEphemeralReply({
      content: NO_CHARACTER_MSG
    }));
  }

  const balance = await services.character.getBalance(character.id);
  
  // Use static shop items for now
  const shopItems = [
    { id: 'potion', name: '🧪 Health Potion', description: 'Memulihkan 50 HP', price: 50, type: 'CONSUMABLE' },
    { id: 'attack_buff', name: '⚔️ Attack Boost', description: 'ATK +5 selama pertarungan', price: 100, type: 'CONSUMABLE' },
    { id: 'defense_buff', name: '🛡️ Defense Boost', description: 'DEF +5 selama pertarungan', price: 100, type: 'CONSUMABLE' },
    { id: 'combat_ration', name: '🍖 Combat Ration', description: 'HP +100, ATK/DEF +3', price: 75, type: 'CONSUMABLE' }
  ];

  // Group items by type
  const groupedItems = shopItems.reduce((acc: Record<string, typeof shopItems>, item) => {
    if (!acc[item.type]) {
      acc[item.type] = [];
    }
    acc[item.type].push(item);
    return acc;
  }, {});

  const embed = new EmbedBuilder()
    .setTitle('🛍️ Shop')
    .setColor('#ffd700')
    .setDescription(`💰 Uangmu: ${balance.coins} coins`)
    .setFooter({ text: 'Gunakan /a s untuk melihat toko' });

  // Add fields for each item type
  for (const [type, items] of Object.entries(groupedItems)) {
    const itemList = items.map(item => 
      `${item.name} - ${item.price} coins\n${item.description}`
    ).join('\n\n');

    embed.addFields([{
      name: `${getItemTypeEmoji(type)} ${type}`,
      value: itemList || 'Tidak ada item'
    }]);
  }

  return interaction.reply({ embeds: [embed], ephemeral: true });
}