import { EmbedBuilder } from 'discord.js';
import { RARITY_COLORS, ITEM_TYPE_EMOJIS, GameItem } from '../config/gameData';
import { CombatResult, CombatParticipant } from '../types/combat';
import { ItemEffect, ShopItem } from '../types/shop';

export class EmbedFactory {
  static buildShopEmbed(balance: number, groupedItems: Record<string, Record<string, ShopItem[]>>) {
    const embed = new EmbedBuilder()
      .setTitle('🛍️ A4A CLAN Shop')
      .setDescription(`💰 Uangmu: ${balance} coins\nGunakan \`/shop buy\` untuk membeli item.`)
      .setColor(0xffd700);

    // Emoji for each rarity
    const rarityEmojis = {
      'LEGENDARY': '🟡',
      'EPIC': '🟣',
      'RARE': '🔵',
      'UNCOMMON': '🟢',
      'COMMON': '⚪'
    };

    // Add fields for each type and rarity
    for (const [type, rarities] of Object.entries(groupedItems)) {
      let fieldValue = '';
      
      for (const [rarity, items] of Object.entries(rarities)) {
        for (const item of items) {
          const emoji = rarityEmojis[rarity as keyof typeof rarityEmojis];
          let itemText = `${emoji} ${item.name} - 💰 ${item.price.toLocaleString()} coins\n${item.description}`;
          
          const effect = item.effect as ItemEffect;
          if (effect?.stats) {
            const stats = Object.entries(effect.stats)
              .map(([stat, value]) => `${stat === 'attack' ? '⚔️' : '🛡️'} ${stat.toUpperCase()}: +${value}`)
              .join(', ');
            itemText += `\n${stats}`;
          }
          
          fieldValue += `${itemText}\n\n`;
        }
      }
      
      if (fieldValue) {
        embed.addFields([{
          name: `${type}`,
          value: fieldValue.trim()
        }]);
      }
    }

    return embed;
  }

  static buildBattleResultEmbed(result: CombatResult) {
    const embed = new EmbedBuilder()
      .setTitle(result.won ? '🎉 Menang!' : '💀 Kalah!')
      .setDescription(result.battleLog.join('\n\n'))
      .setColor(result.won ? '#00ff00' : '#ff0000');

    if (result.monster) {
      embed.addFields([
        { name: '👾 Monster', value: `${result.monster.name} (Level ${result.monster.level})`, inline: true },
        { name: '❤️ HP Tersisa', value: `${result.finalHealth}`, inline: true }
      ]);

      if (result.won) {
        embed.addFields([
          { name: '✨ EXP', value: `+${result.exp}`, inline: true },
          { name: '💰 Coins', value: `+${result.coins}`, inline: true }
        ]);
      }
    }

    return embed;
  }

  static buildDuelResultEmbed(battleLog: string[], winner: CombatParticipant, loser: CombatParticipant) {
    return new EmbedBuilder()
      .setTitle('⚔️ Hasil Duel')
      .setDescription(battleLog.join('\n\n'))
      .setColor(0x00ff00)
      .addFields([
        { name: '🏆 Pemenang', value: winner.name, inline: true },
        { name: '💀 Kalah', value: loser.name, inline: true }
      ])
      .setTimestamp();
  }

  static buildErrorEmbed(message: string) {
    return new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription(message)
      .setColor(0xff0000);
  }

  static buildSuccessEmbed(title: string, message: string) {
    return new EmbedBuilder()
      .setTitle(`✅ ${title}`)
      .setDescription(message)
      .setColor(0x00ff00);
  }

  static buildHelpEmbed() {
    return new EmbedBuilder()
      .setTitle('📚 Game Commands Help')
      .setColor('#0099ff')
      .setDescription('Here are all the available commands:')
      .addFields(
        { name: '🎮 Basic Commands', value: 
          '`/start` - Create your character\n' +
          '`/profile` - View your character stats\n' +
          '`/balance` - Check your coins and bank balance\n' +
          '`/daily` - Claim daily rewards'
        },
        { name: '⚔️ Battle Commands', value:
          '`/hunt` - Hunt monsters for exp and coins\n' +
          '`/heal` - Heal your character\n' +
          '`/duel` - Challenge other players'
        },
        { name: '💰 Economy Commands', value:
          '`/deposit` - Deposit coins to bank\n' +
          '`/withdraw` - Withdraw coins from bank\n' +
          '`/transfer` - Transfer coins to other players'
        }
      );
  }

  static buildBalanceEmbed(coins: number, bank: number, history: any[]) {
    const embed = new EmbedBuilder()
      .setTitle('💰 Balance')
      .setColor('#ffd700')
      .addFields(
        { name: 'Coins', value: `${coins}`, inline: true },
        { name: 'Bank', value: `${bank}`, inline: true },
        { name: 'Total', value: `${coins + bank}`, inline: true }
      );

    if (history.length > 0) {
      const historyText = history
        .map(t => `${t.type}: ${t.amount > 0 ? '+' : ''}${t.amount} (${t.description})`)
        .join('\n');
      embed.addFields({ name: 'Recent Transactions', value: historyText });
    }

    return embed;
  }

  static buildInventoryEmbed(items: GameItem[], page: number = 1, itemsPerPage: number = 10) {
    const startIdx = (page - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const pageItems = items.slice(startIdx, endIdx);
    const totalPages = Math.ceil(items.length / itemsPerPage);

    const embed = new EmbedBuilder()
      .setTitle('🎒 Inventory')
      .setColor('#4CAF50')
      .setFooter({ text: `Page ${page}/${totalPages}` });

    if (pageItems.length === 0) {
      embed.setDescription('Your inventory is empty!');
    } else {
      const itemFields = pageItems.map(item => ({
        name: `${ITEM_TYPE_EMOJIS[item.type]} ${item.name}`,
        value: `${item.description}\nRarity: ${item.rarity}\nValue: ${item.price} coins`,
        inline: true
      }));
      embed.addFields(itemFields);
    }

    return embed;
  }

  static buildDailyRewardEmbed(exp: number, coins: number) {
    return new EmbedBuilder()
      .setTitle('🎁 Daily Rewards')
      .setColor('#00ff00')
      .setDescription('Kamu telah mengklaim hadiah harian!')
      .addFields(
        { name: '✨ Experience', value: `+${exp} EXP`, inline: true },
        { name: '💰 Coins', value: `+${coins} coins`, inline: true }
      );
  }

  static buildLeaderboardEmbed(title: string, description: string, entries: string[], currentPage: number, totalPages: number) {
    return new EmbedBuilder()
      .setTitle(title)
      .setColor('#FFD700')
      .setDescription(description)
      .addFields({
        name: `Rankings (Page ${currentPage}/${totalPages})`,
        value: entries.join('\n')
      })
      .setFooter({ text: `Page ${currentPage}/${totalPages} • Use /leaderboard <type> <page>` })
      .setTimestamp();
  }
} 