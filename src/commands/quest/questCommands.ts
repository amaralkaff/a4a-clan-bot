import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags
  } from 'discord.js';
import { CommandHandler } from '@/types/commands';
import { ServiceContainer } from '@/services';
import { QUESTS } from '@/config/gameData';

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
              { name: "🥊 Latihan Dasar Luffy - Mencari daging (Level 1)", value: "luffy_training_1" },
              { name: "🎯 Latihan Menembak Usopp - Latihan menembak (Level 1)", value: "usopp_training_1" },
              { name: "⚔️ Latihan Pedang Dasar - Berlatih pedang (Level 2)", value: "zoro_training_1" },
              { name: "👨‍🍳 Latihan Memasak - Mencari bahan (Level 3)", value: "sanji_training_1" }
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

  async execute(interaction: ChatInputCommandInteraction, services: ServiceContainer) {
    try {
      const subcommand = interaction.options.getSubcommand();

      const character = await services.character.getCharacterByDiscordId(interaction.user.id);

      if (!character) {
        return interaction.reply({
          content: '❌ Kamu harus membuat karakter terlebih dahulu dengan command `/create`',
          flags: MessageFlags.Ephemeral
        });
      }

      switch (subcommand) {
        case 'list': {
          const questResult = await services.quest.getAvailableQuests(character.id);
          
          return interaction.reply({ 
            embeds: [questResult.embed], 
            flags: MessageFlags.Ephemeral 
          });
        }

        case 'accept': {
          const questId = interaction.options.getString('quest', true);

          // Validate quest ID
          if (!QUESTS[questId as keyof typeof QUESTS]) {
            return interaction.reply({
              content: `❌ Quest "${questId}" tidak valid`,
              flags: MessageFlags.Ephemeral
            });
          }

          const acceptResult = await services.quest.acceptQuest(character.id, questId);
          
          return interaction.reply({
            embeds: [acceptResult.embed],
            flags: MessageFlags.Ephemeral
          });
        }

        case 'complete': {
          const questId = interaction.options.getString('quest', true);

          // Validate quest ID
          const activeQuests = await services.quest.getActiveQuests(character.id);
          const isQuestActive = activeQuests.quests.some(q => q.id === questId);

          if (!isQuestActive) {
            return interaction.reply({
              content: '❌ Quest ini tidak aktif atau sudah selesai',
              flags: MessageFlags.Ephemeral
            });
          }

          const result = await services.quest.completeQuest(character.id, questId);
          
          return interaction.reply({
            embeds: [result.embed],
            flags: MessageFlags.Ephemeral
          });
        }
      }
    } catch (error) {
      services.logger.error('Error in quest command:', error);
      return interaction.reply({
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};