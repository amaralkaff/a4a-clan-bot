import { 
  Message, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ButtonInteraction,
  InteractionCollector
} from 'discord.js';

export interface PaginationOptions<T> {
  items: T[];
  itemsPerPage: number;
  embedBuilder: (items: T[], currentPage: number, totalPages: number) => Promise<EmbedBuilder>;
  userId?: string;
  timeout?: number;
  ephemeral?: boolean;
}

export class PaginationManager {
  private static readonly DEFAULT_TIMEOUT = 300000; // 5 minutes
  private static readonly DEFAULT_ITEMS_PER_PAGE = 5;

  static async paginate<T>(
    source: Message | ChatInputCommandInteraction,
    options: PaginationOptions<T>
  ): Promise<void> {
    const {
      items,
      itemsPerPage = this.DEFAULT_ITEMS_PER_PAGE,
      embedBuilder,
      userId = source instanceof Message ? source.author.id : source.user.id,
      timeout = this.DEFAULT_TIMEOUT,
      ephemeral = true
    } = options;

    const totalPages = Math.ceil(items.length / itemsPerPage);
    if (totalPages === 0) {
      const embed = await embedBuilder([], 1, 1);
      if (source instanceof Message) {
        await source.reply({ embeds: [embed] });
      } else {
        await source.reply({ embeds: [embed], ephemeral });
      }
      return;
    }

    let currentPage = 1;

    const getPageItems = (page: number) => {
      const startIndex = (page - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      return items.slice(startIndex, endIndex);
    };

    const getActionRow = (page: number) => {
      return new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 1),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === totalPages)
        );
    };

    const updateEmbed = async (page: number) => {
      const pageItems = getPageItems(page);
      const embed = await embedBuilder(pageItems, page, totalPages);
      const components = totalPages > 1 ? [getActionRow(page)] : [];
      return { embed, components };
    };

    // Send initial message
    const initial = await updateEmbed(currentPage);
    const reply = await (source instanceof Message
      ? source.reply({ embeds: [initial.embed], components: initial.components })
      : source.reply({ embeds: [initial.embed], components: initial.components, ephemeral }));

    // If only one page, no need for collector
    if (totalPages <= 1) return;

    // Get the message to collect on
    const message = source instanceof Message ? reply : await source.fetchReply();

    // Create collector
    const collector = message.createMessageComponentCollector<ComponentType.Button>({
      filter: (i) => {
        const isValidUser = i.user.id === userId;
        const isValidButton = ['prev', 'next'].includes(i.customId);
        if (!isValidUser) {
          i.reply({ content: '❌ Only the command user can use these buttons!', ephemeral: true });
        }
        return isValidUser && isValidButton;
      },
      time: timeout
    });

    collector.on('collect', async (interaction: ButtonInteraction) => {
      // Update current page
      if (interaction.customId === 'prev') {
        currentPage--;
      } else {
        currentPage++;
      }

      // Update message
      const { embed, components } = await updateEmbed(currentPage);
      await interaction.update({ embeds: [embed], components });
    });

    collector.on('end', () => {
      // Remove buttons when collector expires
      if (message instanceof Message && message.editable) {
        message.edit({ components: [] }).catch(() => {});
      }
    });
  }
} 