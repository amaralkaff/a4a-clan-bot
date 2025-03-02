// src/commands/shop/shopCommands.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, APIEmbedField } from 'discord.js';
import { CommandHandler } from '@/types/commands';
import { createEphemeralReply } from '@/utils/helpers';
import { Message } from 'discord.js';
import { ShopService } from '../../services/ShopService';
import { ITEMS, GameItem } from '../../config/gameData';
import { Effect, EffectType } from '../../types/game';

type ShopItem = GameItem & {
  id: string;
};

interface ItemEffect {
  type: EffectType;
  stats?: {
    attack?: number;
    defense?: number;
  };
}

export const shopCommands: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Beli item dan equipment')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Lihat daftar item yang tersedia')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('buy')
        .setDescription('Beli sebuah item')
        .addStringOption(option =>
          option
            .setName('item')
            .setDescription('Item yang ingin dibeli')
            .setRequired(true)
            .addChoices(
              // Starter Items
              { name: '🧪 Health Potion (50 coins)', value: 'potion' },
              { name: '💖 Full Health Potion (5,000 coins)', value: 'full_health_potion' },
              { name: '🗡️ Wooden Sword (100 coins)', value: 'wooden_sword' },
              { name: '🥋 Training Gi (100 coins)', value: 'training_gi' },
              
              // Legendary Weapons
              { name: '🍎 Gomu Gomu no Mi (500,000 coins)', value: 'gomu_gomu' },
              { name: '🔥 Mera Mera no Mi (500,000 coins)', value: 'mera_mera' },
              { name: '⚔️ Wado Ichimonji (500,000 coins)', value: 'wado_ichimonji' },
              
              // Epic Weapons
              { name: '🌪️ Clima-Tact (450,000 coins)', value: 'clima_tact' },
              { name: '🗡️ Kitetsu (200,000 coins)', value: 'kitetsu' },
              
              // Armor
              { name: '💠 Sea Stone Armor (900,000 coins)', value: 'sea_stone_armor' },
              { name: '🧥 Marine Admiral Coat (600,000 coins)', value: 'marine_admiral_coat' },
              { name: '🥋 Pirate Armor (250,000 coins)', value: 'pirate_armor' },
              
              // Accessories
              { name: '👒 Roger\'s Hat (1,500,000 coins)', value: 'roger_hat' },
              { name: '🧭 Eternal Log Pose (400,000 coins)', value: 'log_pose' },
              
              // Consumables
              { name: '💊 Rumble Ball (1,000 coins)', value: 'rumble_ball' },
              { name: '🍖 Daging Super (800 coins)', value: 'meat' }
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, services) {
    try {
      const character = await services.character.getCharacterByDiscordId(interaction.user.id);
      
      if (!character) {
        return interaction.reply(createEphemeralReply({
          content: '❌ Kamu harus membuat karakter terlebih dahulu dengan `/start`'
        }));
      }

      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'list': {
          const balance = await services.character.getBalance(character.id);
          
          // Group items by type and rarity
          const groupedItems: Record<string, Record<string, ShopItem[]>> = {};
          
          Object.entries(ITEMS).forEach(([id, item]) => {
            if (!groupedItems[item.type]) {
              groupedItems[item.type] = {};
            }
            if (!groupedItems[item.type][item.rarity]) {
              groupedItems[item.type][item.rarity] = [];
            }
            groupedItems[item.type][item.rarity].push({ ...item, id });
          });

          const shopEmbed = {
            title: '🛍️ A4A CLAN Shop',
            description: `💰 Uangmu: ${balance.coins} coins\nGunakan \`/shop buy\` untuk membeli item.`,
            fields: [] as APIEmbedField[]
          };

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
              shopEmbed.fields.push({
                name: `${type}`,
                value: fieldValue.trim()
              });
            }
          }
          
          return interaction.reply({ embeds: [shopEmbed], ephemeral: true });
        }

        case 'buy': {
          const itemId = interaction.options.getString('item', true);
          const result = await services.shop.buyItemSlash(interaction, itemId);
          
          return interaction.reply(createEphemeralReply({
            content: result.message
          }));
        }
      }
    } catch (error) {
      services.logger.error('Error in shop command:', error);
      return interaction.reply(createEphemeralReply({
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    }
  }
};

export async function handleShopCommand(message: Message, args: string[], shopService: ShopService) {
  if (!args || args.length === 0) {
    return shopService.handleShop(message);
  }

  const subCommand = args[0].toLowerCase();
  const subArgs = args.slice(1);

  switch (subCommand) {
    case 'buy':
      return shopService.handleBuyCommand(message, subArgs);
    default:
      return shopService.handleShop(message, args);
  }
} 