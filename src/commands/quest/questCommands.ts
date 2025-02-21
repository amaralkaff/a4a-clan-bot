import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction,
    EmbedBuilder 
  } from 'discord.js';
  import { PrismaClient } from '@prisma/client';
  import { QuestService } from '../../services/QuestService';
  import { logger } from '../../utils/logger';
  
  export const data = new SlashCommandBuilder()
    .setName('quest')
    .setDescription('Quest system commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List available quests')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('accept')
        .setDescription('Accept a quest')
        .addStringOption(option =>
          option
            .setName('quest_name')
            .setDescription('Name of the quest to accept')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('complete')
        .setDescription('Complete a quest')
        .addStringOption(option =>
          option
            .setName('quest_id')
            .setDescription('ID of the quest to complete')
            .setRequired(true)
        )
    );
  
  export async function execute(
    interaction: ChatInputCommandInteraction,
    prisma: PrismaClient
  ) {
    try {
      const questService = new QuestService(prisma);
      const subcommand = interaction.options.getSubcommand();
  
      // Get character
      const character = await prisma.character.findFirst({
        where: {
          user: {
            discordId: interaction.user.id
          }
        }
      });
  
      if (!character) {
        return interaction.reply({
          content: 'Kamu harus membuat karakter terlebih dahulu dengan command `/create-character`',
          ephemeral: true
        });
      }
  
      switch (subcommand) {
        case 'list': {
          const quests = await questService.getAvailableQuests(character.id);
          
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
          const questName = interaction.options.getString('quest_name', true);
          const quest = await questService.acceptQuest(character.id, questName);
          
          return interaction.reply({
            content: `Berhasil menerima quest "${quest.name}"!\n${quest.description}`,
            ephemeral: true
          });
        }
  
        case 'complete': {
          const questId = interaction.options.getString('quest_id', true);
          const result = await questService.completeQuest(character.id, questId);
          
          return interaction.reply({
            content: `Quest berhasil diselesaikan! Kamu mendapatkan ${result.reward} EXP!`,
            ephemeral: true
          });
        }
      }
    } catch (error) {
      logger.error('Error in quest command:', error);
      return interaction.reply({
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ephemeral: true
      });
    }
  }