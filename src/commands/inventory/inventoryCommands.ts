import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    EmbedBuilder 
  } from 'discord.js';
  import { CommandHandler } from '@/types/commands';
  import { createEphemeralReply } from '@/utils/helpers';

  interface ItemEffect {
    type: 'HEAL' | 'BUFF';
    value: number;
    stats?: Record<string, number>;
    duration?: number;
  }

  interface InventoryItem {
    id: string;
    name: string;
    description: string;
    type: 'CONSUMABLE' | 'FOOD' | 'INGREDIENT' | 'EQUIPMENT';
    value: number;
    quantity: number;
    effect: ItemEffect | null;
    createdAt: Date;
    updatedAt: Date;
  }

  function formatItemEffect(effect: { type: string; value: number }): string {
    switch (effect.type) {
      case 'HEAL':
        return `💚 Heal: ${effect.value} HP`;
      case 'BUFF':
        return `⚡ Buff: +${effect.value} stats`;
      default:
        return '';
    }
  }
  
  export const inventoryCommands: CommandHandler = {
    data: new SlashCommandBuilder()
      .setName('inventory')
      .setDescription('Sistem inventaris')
      .addSubcommand(subcommand =>
        subcommand
          .setName('show')
          .setDescription('Tampilkan inventarismu')
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('use')
          .setDescription('Gunakan sebuah item')
          .addStringOption(option =>
            option
              .setName('item')
              .setDescription('Item yang ingin digunakan')
              .setRequired(true)
              .addChoices(
                { name: '🧪 Health Potion (❤️ Heal 50 HP)', value: 'potion' },
                { name: '🔮 Super Potion (❤️ Heal 100 HP)', value: 'super_potion' },
                { name: '⚔️ Attack Boost (💪 ATK +5 1h)', value: 'attack_buff' },
                { name: '🛡️ Defense Boost (🛡️ DEF +5 1h)', value: 'defense_buff' },
                { name: '🍖 Daging Panggang (❤️ Heal 20 HP)', value: 'meat_cooked' },
                { name: '👨‍🍳 Hidangan Spesial Sanji (⚡ ATK & DEF +10 1h)', value: 'sanji_special' },
                { name: '🎒 Combat Ration (❤️ +30 HP, ⚡ ATK & DEF +3 30m)', value: 'combat_ration' }
              )
          )
      ),
  
    async execute(interaction: ChatInputCommandInteraction, services) {
      try {
        const character = await services.character.getCharacterByDiscordId(interaction.user.id);
  
        if (!character) {
          return interaction.reply(createEphemeralReply({
            content: '❌ Kamu harus membuat karakter terlebih dahulu dengan command `/create`'
          }));
        }
  
        const subcommand = interaction.options.getSubcommand();
  
        switch (subcommand) {
          case 'show': {
            const inventory = await services.inventory.getInventory(character.id) as InventoryItem[];
            
            const embed = new EmbedBuilder()
              .setTitle('🎒 Inventory')
              .setColor('#0099ff');

            if (inventory.length > 0) {
              const groupedItems = inventory.reduce((acc, item) => {
                if (!acc[item.type]) acc[item.type] = [];
                acc[item.type].push(item);
                return acc;
              }, {} as Record<string, InventoryItem[]>);

              for (const [type, items] of Object.entries(groupedItems)) {
                let typeEmoji = '';
                switch (type) {
                  case 'CONSUMABLE': typeEmoji = '🧪'; break;
                  case 'FOOD': typeEmoji = '🍖'; break;
                  case 'INGREDIENT': typeEmoji = '📦'; break;
                  case 'EQUIPMENT': typeEmoji = '⚔️'; break;
                  default: typeEmoji = '📝';
                }

                const itemList = items.map(item => {
                  let effectText = '';
                  if (item.effect) {
                    if (item.effect.type === 'HEAL') {
                      effectText = `\n❤️ Heal: ${item.effect.value} HP`;
                    } else if (item.effect.type === 'BUFF') {
                      const stats = item.effect.stats || {};
                      const duration = item.effect.duration ? `${item.effect.duration / 3600}h` : '1h';
                      effectText = `\n⚡ Buff: ${Object.entries(stats).map(([stat, val]) => 
                        `${stat.toUpperCase()} +${val}`).join(', ')} (${duration})`;
                    }
                  }
                  return `${item.name} (${item.quantity}x)\n${item.description}${effectText}`;
                }).join('\n\n');

                embed.addFields({
                  name: `${typeEmoji} ${type}`,
                  value: itemList
                });
              }
            } else {
              embed.setDescription('📭 Inventory kosong');
            }
  
            return interaction.reply({ embeds: [embed], ephemeral: true });
          }
  
          case 'use': {
            const itemId = interaction.options.getString('item', true);
            const result = await services.inventory.useItem(character.id, itemId);
            
            return interaction.reply(createEphemeralReply({
              content: `✅ ${result.message}`
            }));
          }
        }
      } catch (error) {
        services.logger.error('Error in inventory command:', error);
        return interaction.reply(createEphemeralReply({
          content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }));
      }
    }
  };