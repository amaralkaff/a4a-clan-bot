import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    EmbedBuilder 
  } from 'discord.js';
  import { CommandHandler } from '@/types/commands';
  import { createEphemeralReply } from '@/utils/helpers';

  interface InventoryItem {
    id: string;
    name: string;
    description: string;
    type: string;
    value: number;
    maxDurability: number | null;
    stackLimit: number;
    rarity: string;
    baseStats: string | null;
    upgradeStats: string | null;
    maxLevel: number | null;
    quantity: number;
    effect: {
      type: 'EQUIP' | 'HEAL';
      stats?: {
        attack?: number;
        defense?: number;
      };
      health?: number;
    };
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
              .setAutocomplete(true)
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
              .setTitle(`🎒 Inventory ${character.name}`)
              .setColor('#0099ff');

            if (inventory.length > 0) {
              const groupedItems = inventory.reduce((acc, item) => {
                if (!acc[item.type]) acc[item.type] = [];
                acc[item.type].push(item);
                return acc;
              }, {} as Record<string, InventoryItem[]>);

              const typeOrder = ['WEAPON', 'ARMOR', 'ACCESSORY', 'CONSUMABLE'];
              
              for (const type of typeOrder) {
                if (groupedItems[type] && groupedItems[type].length > 0) {
                  const typeEmoji = {
                    'WEAPON': '⚔️',
                    'ARMOR': '🛡️',
                    'ACCESSORY': '📿',
                    'CONSUMABLE': '🧪'
                  }[type] || '📝';

                  const itemList = groupedItems[type].map(item => {
                    let itemText = '';
                    
                    // Add equipped status if it's equipment
                    if (item.effect?.type === 'EQUIP') {
                      const stats = item.effect.stats;
                      const equipped = stats && (
                        (stats.attack ?? 0) > 0 || 
                        (stats.defense ?? 0) > 0
                      );
                      if (equipped) {
                        itemText += '✅ ';
                      }
                    }
                    
                    // Add item name and quantity
                    itemText += `${item.name} (x${item.quantity})`;
                    
                    // Add durability if applicable
                    if (item.maxDurability) {
                      const currentDurability = item.maxDurability; // TODO: Get actual durability from inventory
                      const durabilityPercent = (currentDurability / item.maxDurability) * 100;
                      const durabilityColor = 
                        durabilityPercent > 70 ? '🟢' :
                        durabilityPercent > 30 ? '🟡' : '🔴';
                      itemText += ` ${durabilityColor}[${currentDurability}/${item.maxDurability}]`;
                    }
                    
                    // Add description
                    itemText += `\n${item.description}`;
                    
                    // Add rarity
                    const rarityColor = {
                      'COMMON': '⚪',
                      'UNCOMMON': '🟢',
                      'RARE': '🔵',
                      'EPIC': '🟣',
                      'LEGENDARY': '🟡'
                    }[item.rarity];
                    itemText += `\n${rarityColor} ${item.rarity}`;
                    
                    // Add effect
                    if (item.effect) {
                      if (item.effect.type === 'EQUIP' && item.effect.stats) {
                        const stats = Object.entries(item.effect.stats)
                          .filter(([_, value]) => value > 0)
                          .map(([stat, value]) => {
                            const statEmoji = stat === 'attack' ? '⚔️' : '🛡️';
                            return `${statEmoji} ${stat.toUpperCase()} +${value}`;
                          })
                          .join(', ');
                        if (stats) {
                          itemText += `\n${stats}`;
                        }
                      } else if (item.effect.type === 'HEAL') {
                        itemText += `\n❤️ Heal: ${item.effect.health} HP`;
                      }
                    }
                    
                    return itemText;
                  }).join('\n\n');

                  embed.addFields({
                    name: `${typeEmoji} ${type}`,
                    value: itemList || 'Empty',
                    inline: false
                  });
                }
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
  
          default:
            return interaction.reply(createEphemeralReply({
              content: '❌ Invalid subcommand'
            }));
        }
      } catch (error) {
        services.logger.error('Error in inventory command:', error);
        return interaction.reply(createEphemeralReply({
          content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }));
      }
    }
  };