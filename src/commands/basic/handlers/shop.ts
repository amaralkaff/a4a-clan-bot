import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ServiceContainer } from '@/services';
import { createEphemeralReply } from '@/utils/helpers';
import { getItemTypeEmoji } from './utils';
import { ITEMS } from '@/config/gameData';
import { EffectData } from '@/types/game';

const NO_CHARACTER_MSG = '❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.';

// Helper function to get effect data
function getEffectData(effect: any): EffectData | undefined {
  if (!effect) return undefined;
  if (typeof effect === 'string') {
    try {
      const parsed = JSON.parse(effect);
      if (parsed && typeof parsed === 'object' && 'type' in parsed) {
        return parsed as EffectData;
      }
    } catch (error) {
      return undefined;
    }
  }
  return effect as EffectData;
}

export async function handleShopView(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  const character = await services.character.getCharacterByDiscordId(interaction.user.id);
  if (!character) {
    return interaction.reply(createEphemeralReply({
      content: NO_CHARACTER_MSG
    }));
  }

  const balance = await services.character.getBalance(character.id);
  
  // Use items from game data configuration
  const shopItems = Object.entries(ITEMS).map(([id, item]) => ({
    id,
    name: item.name,
    description: item.description,
    price: item.price,
    type: item.type,
    effect: item.effect,
    rarity: item.rarity
  }));

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
    .setDescription(`💰 Uangmu: ${balance.coins} coins\nGunakan \`a buy [nama_item] [jumlah]\` untuk membeli item.`)
    .setFooter({ text: 'Contoh: a buy potion 5' });

  // Add fields for each item type
  for (const [type, items] of Object.entries(groupedItems)) {
    const itemList = items.map(item => {
      let text = `${item.name} - 💰 ${item.price} coins\n${item.description}`;
      
      // Add stats if item has effect
      const effectData = getEffectData(item.effect);
      if (effectData?.stats) {
        const stats = Object.entries(effectData.stats)
          .map(([stat, value]) => `${stat === 'attack' ? '⚔️' : '🛡️'} ${stat.toUpperCase()}: +${value}`)
          .join(', ');
        if (stats) {
          text += `\n${stats}`;
        }
      }

      // Add rarity indicator
      const rarityEmoji = {
        'COMMON': '⚪',
        'UNCOMMON': '🟢',
        'RARE': '🔵',
        'EPIC': '🟣',
        'LEGENDARY': '🟡'
      }[item.rarity] || '⚪';
      
      return `${rarityEmoji} ${text}`;
    }).join('\n\n');

    embed.addFields([{
      name: `${getItemTypeEmoji(type)} ${type}`,
      value: itemList || 'Tidak ada item'
    }]);
  }

  return interaction.reply({ embeds: [embed], ephemeral: true });
}