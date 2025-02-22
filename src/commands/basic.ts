import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CommandHandler } from '@/types/commands';
import { createEphemeralReply } from '@/utils/helpers';
import { ServiceContainer } from '@/services';
import { checkCooldown, setCooldown, getRemainingCooldown, getCooldownMessage } from '@/utils/cooldown';
import { MONSTERS, LOCATIONS } from '@/config/gameData';
import { LocationId } from '@/types/game';

// Random encounters for hunt
const ENCOUNTERS = {
  COMMON: {
    chance: 0.7,
    monsters: [
      { name: '🐗 Wild Boar', level: [1, 3], exp: 20, coins: [10, 30] },
      { name: '🐺 Wolf', level: [2, 4], exp: 25, coins: [15, 35] },
      { name: '🦊 Fox', level: [3, 5], exp: 30, coins: [20, 40] }
    ]
  },
  RARE: {
    chance: 0.2,
    monsters: [
      { name: '🐉 Baby Dragon', level: [4, 6], exp: 50, coins: [40, 60] },
      { name: '🦁 Lion', level: [5, 7], exp: 55, coins: [45, 65] },
      { name: '🐯 Tiger', level: [6, 8], exp: 60, coins: [50, 70] }
    ]
  },
  EPIC: {
    chance: 0.08,
    monsters: [
      { name: '🐲 Adult Dragon', level: [7, 9], exp: 100, coins: [80, 120] },
      { name: '🦅 Giant Eagle', level: [8, 10], exp: 110, coins: [90, 130] },
      { name: '🐘 War Elephant', level: [9, 11], exp: 120, coins: [100, 140] }
    ]
  },
  LEGENDARY: {
    chance: 0.02,
    monsters: [
      { name: '🔥 Phoenix', level: [10, 12], exp: 200, coins: [150, 250] },
      { name: '⚡ Thunder Bird', level: [11, 13], exp: 220, coins: [170, 270] },
      { name: '🌊 Leviathan', level: [12, 14], exp: 240, coins: [190, 290] }
    ]
  }
};

function getRandomMonster(characterLevel: number) {
  const rand = Math.random();
  let cumChance = 0;
  
  for (const [rarity, data] of Object.entries(ENCOUNTERS)) {
    cumChance += data.chance;
    if (rand <= cumChance) {
      const possibleMonsters = data.monsters.filter(m => 
        m.level[0] <= characterLevel + 3 && m.level[1] >= characterLevel - 1
      );
      if (possibleMonsters.length === 0) continue;
      return possibleMonsters[Math.floor(Math.random() * possibleMonsters.length)];
    }
  }
  
  return ENCOUNTERS.COMMON.monsters[0]; // Fallback to first common monster
}

// Update error messages
const NO_CHARACTER_MSG = '❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.';

async function handleHunt(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  const userId = interaction.user.id;
  
  // Check cooldown
  if (!checkCooldown(userId, 'hunt')) {
    const remainingTime = getRemainingCooldown(userId, 'hunt');
    return interaction.reply(createEphemeralReply({
      content: getCooldownMessage('hunt', remainingTime)
    }));
  }

  const character = await services.character.getCharacterByDiscordId(userId);
  if (!character) {
    return interaction.reply(createEphemeralReply({
      content: NO_CHARACTER_MSG
    }));
  }

  // Get random monster based on character level
  const monster = getRandomMonster(character.level);
  
  // Calculate rewards
  const exp = monster.exp;
  const coins = Math.floor(Math.random() * (monster.coins[1] - monster.coins[0] + 1)) + monster.coins[0];

  // Process battle
  const result = await services.battle.processBattle(character.id, monster.level[0]);
  
  // Update rewards if won
  if (result.won) {
    await services.character.addExperience(character.id, exp);
    await services.character.addCoins(character.id, coins, 'HUNT', `Hunt reward from ${monster.name}`);
  }

  // Create result embed
  const embed = new EmbedBuilder()
    .setTitle(`🗡️ Hunt Result: ${monster.name}`)
    .setColor(result.won ? '#00ff00' : '#ff0000')
    .setDescription(result.won ? 'You won!' : 'You lost!')
    .addFields(
      { name: '✨ Experience', value: result.won ? `+${exp} EXP` : '0 EXP', inline: true },
      { name: '💰 Coins', value: result.won ? `+${coins} coins` : '0 coins', inline: true }
    );

  // Set cooldown
  setCooldown(userId, 'hunt');

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleProfile(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  const character = await services.character.getCharacterByDiscordId(interaction.user.id);
  
  if (!character) {
    return interaction.reply(createEphemeralReply({
      content: NO_CHARACTER_MSG
    }));
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

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDaily(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  const userId = interaction.user.id;
  
  // Check cooldown
  if (!checkCooldown(userId, 'daily')) {
    const remainingTime = getRemainingCooldown(userId, 'daily');
    const hours = Math.floor(remainingTime / 3600);
    const minutes = Math.floor((remainingTime % 3600) / 60);
    return interaction.reply(createEphemeralReply({
      content: `⏰ Daily reward sedang cooldown!\nTunggu ${hours}h ${minutes}m lagi.`
    }));
  }

  const character = await services.character.getCharacterByDiscordId(userId);
  if (!character) {
    return interaction.reply(createEphemeralReply({
      content: NO_CHARACTER_MSG
    }));
  }

  // Calculate rewards
  const exp = 100 + Math.floor(Math.random() * 50);
  const coins = 100 + Math.floor(Math.random() * 100);
  
  // Update character
  await services.character.addExperience(character.id, exp);
  await services.character.addCoins(character.id, coins, 'DAILY', 'Daily reward');
  
  const embed = new EmbedBuilder()
    .setTitle('🎁 Daily Rewards')
    .setColor('#00ff00')
    .setDescription('Kamu telah mengklaim hadiah harian!')
    .addFields(
      { name: '✨ Experience', value: `+${exp} EXP`, inline: true },
      { name: '💰 Coins', value: `+${coins} coins`, inline: true }
    );

  // Set cooldown
  setCooldown(userId, 'daily');

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

// Main command structure (like OwO bot)
export const basicCommands: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('a')
    .setDescription('A4A CLAN BOT - One Piece RPG')
    .addSubcommand(subcommand =>
      subcommand
        .setName('p')
        .setDescription('📊 Lihat profilmu')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('h')
        .setDescription('🗡️ Berburu monster (15s cooldown)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('d')
        .setDescription('🎁 Hadiah harian')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('i')
        .setDescription('🎒 Lihat inventorymu')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('b')
        .setDescription('💰 Lihat uangmu')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('t')
        .setDescription('⚔️ Latihan dengan mentor')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('m')
        .setDescription('🗺️ Lihat peta dunia')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('s')
        .setDescription('🛍️ Buka toko')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('u')
        .setDescription('📦 Gunakan item')
        .addStringOption(option =>
          option
            .setName('item')
            .setDescription('Item yang ingin digunakan')
            .setRequired(true)
            .addChoices(
              { name: '🧪 Health Potion (Heal 50 HP)', value: 'potion' },
              { name: '⚔️ Attack Boost (+5 ATK)', value: 'attack_buff' },
              { name: '🛡️ Defense Boost (+5 DEF)', value: 'defense_buff' },
              { name: '🍖 Combat Ration (Heal 100 HP, +3 ATK/DEF)', value: 'combat_ration' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('help')
        .setDescription('❓ Panduan bermain')
    ),

  async execute(interaction: ChatInputCommandInteraction, services) {
    try {
      const subcommand = interaction.options.getSubcommand();

      // Check if character exists (except for help command)
      if (subcommand !== 'help') {
        const character = await services.character.getCharacterByDiscordId(interaction.user.id);
        if (!character) {
          return interaction.reply(createEphemeralReply({
            content: NO_CHARACTER_MSG
          }));
        }
      }

      switch(subcommand) {
        case 'p': return handleProfile(interaction, services);
        case 'h': return handleHunt(interaction, services);
        case 'd': return handleDaily(interaction, services);
        case 'i': return handleInventoryView(interaction, services);
        case 'b': return handleWallet(interaction, services);
        case 't': return handleTraining(interaction, services);
        case 'm': return handleMapView(interaction, services);
        case 's': return handleShopView(interaction, services);
        case 'u': return handleUseItem(interaction, services);
        case 'help': return handleHelp(interaction);
      }

    } catch (error) {
      services.logger.error('Error in command:', error);
      return interaction.reply(createEphemeralReply({
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    }
  }
};

async function handleHelp(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('❓ A4A CLAN BOT - Panduan')
    .setColor('#00ff00')
    .setDescription('One Piece RPG Game')
    .addFields([
      { 
        name: '📜 Basic Commands', 
        value: 
`\`a p\` - 📊 Lihat profil
\`a h\` - 🗡️ Berburu (15s cd)
\`a d\` - 🎁 Daily reward
\`a i\` - 🎒 Inventory
\`a u\` - 📦 Gunakan item
\`a b\` - 💰 Balance
\`a t\` - ⚔️ Training
\`a m\` - 🗺️ Map
\`a s\` - 🛍️ Shop`
      },
      {
        name: '🎮 Tips',
        value: 'Mulai dengan berburu di Foosha Village untuk mendapatkan EXP dan item!'
      }
    ]);

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleTraining(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  // Implementation will be added in MentorService
  return interaction.reply(createEphemeralReply({
    content: '🔄 Fitur dalam pengembangan...'
  }));
}

async function handleInventoryView(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  const character = await services.character.getCharacterByDiscordId(interaction.user.id);
  if (!character) {
    return interaction.reply(createEphemeralReply({
      content: NO_CHARACTER_MSG
    }));
  }

  const inventory = await services.inventory.getInventory(character.id);
  if (!inventory || inventory.length === 0) {
    return interaction.reply(createEphemeralReply({
      content: '📦 Inventorymu masih kosong!'
    }));
  }

  // Group items by type
  const groupedItems = inventory.reduce((acc: Record<string, Array<{name: string; description: string; quantity: number; type: string}>>, inv) => {
    if (!acc[inv.type]) {
      acc[inv.type] = [];
    }
    acc[inv.type].push({
      name: inv.name,
      description: inv.description,
      quantity: inv.quantity,
      type: inv.type
    });
    return acc;
  }, {});

  const embed = new EmbedBuilder()
    .setTitle(`📦 Inventory ${character.name}`)
    .setColor('#0099ff');

  // Add fields for each item type
  for (const [type, items] of Object.entries(groupedItems)) {
    const itemList = items.map(item => 
      `${item.name} (x${item.quantity})\n${item.description}`
    ).join('\n\n');

    embed.addFields([{
      name: `${getItemTypeEmoji(type)} ${type}`,
      value: itemList || 'Kosong'
    }]);
  }

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

// Helper function for item type emoji
function getItemTypeEmoji(type: string): string {
  const emojiMap: Record<string, string> = {
    'CONSUMABLE': '🧪',
    'WEAPON': '⚔️',
    'ARMOR': '🛡️',
    'MATERIAL': '📦',
    'FOOD': '🍖',
    'INGREDIENT': '🌿'
  };
  return emojiMap[type] || '📦';
}

async function handleShopView(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
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

async function handleWallet(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
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

async function handleMapView(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  const character = await services.character.getCharacterByDiscordId(interaction.user.id);
  if (!character) {
    return interaction.reply(createEphemeralReply({
      content: NO_CHARACTER_MSG
    }));
  }

  const currentLocation = LOCATIONS[character.currentIsland as LocationId];
  const embed = new EmbedBuilder()
    .setTitle('🗺️ Peta Dunia')
    .setColor('#0099ff')
    .setDescription('Lokasi yang tersedia untuk dijelajahi:')
    .addFields([
      { 
        name: '📍 Lokasimu Saat Ini', 
        value: `${currentLocation.name}\n${currentLocation.description}`,
        inline: false 
      }
    ]);

  // Group locations by level requirement
  const groupedLocations = Object.entries(LOCATIONS).reduce((acc, [id, loc]) => {
    const tier = loc.level <= 5 ? 'STARTER' :
                loc.level <= 15 ? 'INTERMEDIATE' :
                'ADVANCED';
    if (!acc[tier]) {
      acc[tier] = [];
    }
    acc[tier].push({ id, ...loc });
    return acc;
  }, {} as Record<string, Array<{id: string; name: string; description: string; level: number}>>);

  // Add fields for each tier
  for (const [tier, locations] of Object.entries(groupedLocations)) {
    const locationList = locations.map(loc => 
      `${loc.name} (Lv.${loc.level}+)\n` +
      `${character.currentIsland === loc.id ? '📍 ' : ''}${loc.description}`
    ).join('\n\n');

    embed.addFields([{
      name: `${getTierEmoji(tier)} ${tier} ISLANDS`,
      value: locationList
    }]);
  }

  // Add travel tip
  embed.setFooter({ 
    text: 'Gunakan /a m untuk melihat peta' 
  });

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

// Helper function for location tier emoji
function getTierEmoji(tier: string): string {
  const emojiMap: Record<string, string> = {
    'STARTER': '🏝️',
    'INTERMEDIATE': '🏰',
    'ADVANCED': '⚔️'
  };
  return emojiMap[tier] || '🗺️';
}

// Helper function for mentor emoji
function getMentorEmoji(mentor: string): string {
  const emojiMap: Record<string, string> = {
    'YB': '⚔️',
    'Tierison': '🗡️',
    'LYuka': '🎯',
    'GarryAng': '🔥'
  };
  return emojiMap[mentor] || '👨‍🏫';
}

// Add handleUseItem function
async function handleUseItem(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
  const character = await services.character.getCharacterByDiscordId(interaction.user.id);
  if (!character) {
    return interaction.reply(createEphemeralReply({
      content: NO_CHARACTER_MSG
    }));
  }

  const itemId = interaction.options.getString('item', true);
  
  try {
    const result = await services.inventory.useItem(character.id, itemId);
    
    if (!result.success) {
      return interaction.reply(createEphemeralReply({
        content: `❌ ${result.message}`
      }));
    }

    const embed = new EmbedBuilder()
      .setTitle('✨ Item Digunakan!')
      .setColor('#00ff00')
      .setDescription(result.message)
      .addFields([
        { name: '📦 Item', value: result.item.name, inline: true },
        { name: '✨ Efek', value: result.item.effect, inline: true }
      ]);

    if (result.item.type === 'CONSUMABLE') {
      embed.addFields([
        { name: '❤️ HP', value: `${character.health} → ${character.health + result.item.value}`, inline: true }
      ]);
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    return interaction.reply(createEphemeralReply({
      content: `❌ Gagal menggunakan item: ${error instanceof Error ? error.message : 'Unknown error'}`
    }));
  }
} 