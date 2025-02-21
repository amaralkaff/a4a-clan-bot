import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    EmbedBuilder 
  } from 'discord.js';
import { CommandHandler } from '@/types/commands';

export const questCommands: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('quest')
    .setDescription('Sistem quest')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Lihat quest yang tersedia')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('accept')
        .setDescription('Terima sebuah quest')
        .addStringOption(option =>
          option
            .setName('quest')
            .setDescription('Quest yang ingin diambil')
            .setRequired(true)
            .addChoices(
              { name: "Luffy's First Mission - Mencari daging (Level 1)", value: "Luffy's First Mission" },
              { name: "Usopp's Target Practice - Latihan menembak (Level 1)", value: "Usopp's Target Practice" },
              { name: "Zoro's Training - Berlatih pedang (Level 2)", value: "Zoro's Training" },
              { name: "Sanji's Cooking Challenge - Mencari bahan (Level 3)", value: "Sanji's Cooking Challenge" }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('complete')
        .setDescription('Selesaikan quest yang aktif')
        .addStringOption(option =>
          option
            .setName('quest')
            .setDescription('Quest yang ingin diselesaikan')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async execute(interaction, services) {
    try {
      const subcommand = interaction.options.getSubcommand();

      const character = await services.character.getCharacterByDiscordId(interaction.user.id);

      if (!character) {
        return interaction.reply({
          content: 'Kamu harus membuat karakter terlebih dahulu dengan command `/create`',
          ephemeral: true
        });
      }

      switch (subcommand) {
        case 'list': {
          const quests = await services.quest.getAvailableQuests(character.id);
          
          const embed = new EmbedBuilder()
            .setTitle('Quest yang Tersedia')
            .setColor('#0099ff')
            .setDescription(
              quests.length > 0
                ? quests.map(quest => 
                    `**${quest.name}**\n${quest.description}\nReward: ${quest.reward} EXP\nRequired Level: ${quest.requiredLevel}`
                  ).join('\n\n')
                : 'Tidak ada quest yang tersedia saat ini.'
            );

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        case 'accept': {
          const questName = interaction.options.getString('quest', true);
          const quest = await services.quest.acceptQuest(character.id, questName);
          
          return interaction.reply({
            content: `Berhasil menerima quest "${quest.name}"!\n${quest.description}`,
            ephemeral: true
          });
        }

        case 'complete': {
          const questId = interaction.options.getString('quest', true);
          const result = await services.quest.completeQuest(character.id, questId);
          
          return interaction.reply({
            content: `Quest berhasil diselesaikan! Kamu mendapatkan ${result.reward} EXP!`,
            ephemeral: true
          });
        }
      }
    } catch (error) {
      services.logger.error('Error in quest command:', error);
      return interaction.reply({
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ephemeral: true
      });
    }
  }
};