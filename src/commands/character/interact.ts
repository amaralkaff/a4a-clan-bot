import { SlashCommandBuilder } from 'discord.js';
import { CommandHandler } from '@/types/commands';
import { createEphemeralReply } from '@/utils/helpers';
import { MentorType } from '@/types/game';

export const interactNpc: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName('interact')
    .setDescription('Berinteraksi dengan NPC')
    .addStringOption(option =>
      option
        .setName('npc')
        .setDescription('NPC yang ingin diajak berinteraksi')
        .setRequired(true)
        .addChoices(
          { name: 'Luffy (YB) - Combat Focus', value: 'YB' },
          { name: 'Zoro (Tierison) - Explorer', value: 'Tierison' },
          { name: 'Usopp (LYuka) - Sniper', value: 'LYuka' },
          { name: 'Sanji (GarryAng) - Support', value: 'GarryAng' }
        )
    )
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Aksi yang ingin dilakukan')
        .setRequired(false)
        .addChoices(
          { name: '🗣️ Bicara', value: 'DIALOGUE' },
          { name: '📜 Ambil Quest', value: 'QUEST' },
          { name: '⚔️ Latihan', value: 'TRAINING' },
          { name: '🤝 Barter', value: 'TRADE' }
        )
    ),

  async execute(interaction, services) {
    try {
      const npcId = interaction.options.getString('npc', true) as MentorType;
      const action = interaction.options.getString('action') || 'DIALOGUE';
      const character = await services.character.getCharacterByDiscordId(interaction.user.id);

      if (!character) {
        return interaction.reply(createEphemeralReply({
          content: 'Kamu belum memiliki karakter! Gunakan `/create` untuk membuat karakter.'
        }));
      }

      // Get NPC interaction result
      const result = await services.npc.interactWithNpc(character.id, npcId);

      if (!result.requirementsMet) {
        return interaction.reply(createEphemeralReply({
          content: result.dialogue
        }));
      }

      // Check if requested action is available
      if (!result.availableActions.includes(action)) {
        return interaction.reply(createEphemeralReply({
          content: `❌ Aksi "${action}" tidak tersedia saat ini.\nAksi yang tersedia: ${result.availableActions.join(', ')}`
        }));
      }

      // Format response based on action
      let responseContent = '';
      switch (action) {
        case 'DIALOGUE':
          responseContent = `💬 ${result.dialogue}\n\n`;
          if (result.loyalty) {
            responseContent += `👥 Loyalty: ${result.loyalty}%\n`;
          }
          break;

        case 'QUEST':
          // Show available quests from this NPC
          const questResult = await services.quest.getAvailableQuests(character.id);
          const npcQuests = questResult.quests.filter(q => q.mentor === npcId);
          
          if (npcQuests.length === 0) {
            responseContent = '❌ Tidak ada quest yang tersedia dari NPC ini saat ini.';
          } else {
            responseContent = '📜 Quest yang tersedia:\n\n' + 
              npcQuests.map(q => 
                `**${q.name}** (Level ${q.requiredLevel}+)\n${q.description}\n💰 Reward: ${q.reward} EXP`
              ).join('\n\n');
          }
          break;

        case 'TRAINING':
          // Check if character can train
          if (character.level < 5) {
            responseContent = '❌ Kamu harus mencapai level 5 untuk mulai berlatih!';
          } else {
            // Apply training effects based on mentor
            switch (npcId) {
              case 'YB':
                await services.character.addBuff(character.id, {
                  type: 'ATTACK',
                  value: 5,
                  expiresAt: Date.now() + (3600 * 1000) // 1 hour
                });
                responseContent = '💪 Luffy mengajarkan teknik Gear Second! Attack +5 selama 1 jam.';
                break;
              case 'Tierison':
                await services.character.addBuff(character.id, {
                  type: 'ALL',
                  value: 3,
                  expiresAt: Date.now() + (3600 * 1000)
                });
                responseContent = '⚔️ Zoro mengajarkan Three Sword Style! Semua stats +3 selama 1 jam.';
                break;
              case 'LYuka':
                await services.character.addBuff(character.id, {
                  type: 'DEFENSE',
                  value: 5,
                  expiresAt: Date.now() + (3600 * 1000)
                });
                responseContent = '🎯 Usopp mengajarkan teknik bertahan! Defense +5 selama 1 jam.';
                break;
              case 'GarryAng':
                await services.character.addStatusEffect(character.id, {
                  type: 'HEAL_OVER_TIME',
                  value: 10,
                  duration: 5
                });
                responseContent = '🍳 Sanji memberikan makanan spesial! Regenerasi 10 HP selama 5 turn.';
                break;
            }
          }
          break;

        case 'TRADE':
          responseContent = '🛍️ Fitur barter akan segera tersedia!';
          break;
      }

      return interaction.reply(createEphemeralReply({
        content: responseContent
      }));
    } catch (error) {
      services.logger.error('Error in interact command:', error);
      return interaction.reply(createEphemeralReply({
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    }
  }
};
