import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalSubmitInteraction,
  ButtonInteraction,
  MessageFlags
} from 'discord.js';
import { randomUUID } from 'crypto';
import { StorageFactory } from '../storage/storage-factory';
import { PotluckItem } from '../storage/potluck';

const storage = StorageFactory.getStorage();

// Collectors are no longer needed since we handle interactions directly

// 15 minute limit for Discord message edits (in milliseconds)
const DISCORD_EDIT_TIME_LIMIT = 15 * 60 * 1000;

function isMessageEditExpired(messageCreatedAt: Date): boolean {
  const now = new Date();
  const timeDiff = now.getTime() - messageCreatedAt.getTime();
  return timeDiff > DISCORD_EDIT_TIME_LIMIT;
}

// Collector setup is no longer needed since we handle interactions directly

async function updatePotluckDisplay(potluckId: string, channel: any): Promise<any | null> {
  const potluck = await storage.getPotluck(potluckId);
  if (!potluck || !potluck.messageId || !potluck.messageCreatedAt) {
    return null;
  }

  const newEmbed = createPotluckEmbed(potluck);
  const newButtons = createPotluckButtons(potluck);

  try {
    // Try to edit the existing message first
    if (!isMessageEditExpired(potluck.messageCreatedAt)) {
      const existingMessage = await channel.messages.fetch(potluck.messageId);
      await existingMessage.edit({ embeds: [newEmbed], components: newButtons });
      return existingMessage;
    } else {
      // Message edit window expired, create new message
      
      // Try to delete the old message first
      try {
        const oldMessage = await channel.messages.fetch(potluck.messageId);
        await oldMessage.delete();
      } catch (deleteError) {
        console.log('Could not delete old message:', deleteError instanceof Error ? deleteError.message : 'Unknown error');
      }
      
      // Create a new message and update storage
      const newMessage = await channel.send({ 
        embeds: [newEmbed], 
        components: newButtons
      });
      
      await storage.updatePotluckMessage(potluckId, newMessage.id, new Date());
      
      // No collector setup needed - interactions handled directly
      
      return newMessage;
    }
  } catch (error) {
    console.log('Error updating potluck message:', error instanceof Error ? error.message : 'Unknown error');
    
    // Fallback: create new message if edit fails for any reason
    try {
      // Try to delete the old message in fallback too
      try {
        const oldMessage = await channel.messages.fetch(potluck.messageId);
        await oldMessage.delete();
      } catch (deleteError) {
        console.log('Could not delete old message in fallback:', deleteError instanceof Error ? deleteError.message : 'Unknown error');
      }
      
      const newMessage = await channel.send({ 
        embeds: [newEmbed], 
        components: newButtons
      });
      
      await storage.updatePotluckMessage(potluckId, newMessage.id, new Date());
      
      // No collector setup needed - interactions handled directly
      
      return newMessage;
    } catch (fallbackError) {
      console.log('Failed to create fallback message:', fallbackError instanceof Error ? fallbackError.message : 'Unknown error');
      return null;
    }
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('potluck')
    .setDescription('Create and manage potluck events'),

  async execute(interaction: ChatInputCommandInteraction) {
    const modal = new ModalBuilder()
      .setCustomId('potluck-create')
      .setTitle('Create Potluck Event');

    const nameInput = new TextInputBuilder()
      .setCustomId('potluck-name')
      .setLabel('Potluck Name')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const dateInput = new TextInputBuilder()
      .setCustomId('potluck-date')
      .setLabel('Date (optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder('e.g., Saturday, Dec 14th at 6pm')
      .setMaxLength(100);

    const themeInput = new TextInputBuilder()
      .setCustomId('potluck-theme')
      .setLabel('Theme (optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder('e.g., Tacos, Italian, Holiday treats')
      .setMaxLength(100);

    const itemsInput = new TextInputBuilder()
      .setCustomId('potluck-items')
      .setLabel('Items needed (one per line)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder('lettuce\nmeat\ntortillas\nbeans\nsour cream\ncheese\nsalsa')
      .setMaxLength(2000);

    const nameRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
    const dateRow = new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput);
    const themeRow = new ActionRowBuilder<TextInputBuilder>().addComponents(themeInput);
    const itemsRow = new ActionRowBuilder<TextInputBuilder>().addComponents(itemsInput);

    modal.addComponents(nameRow, dateRow, themeRow, itemsRow);

    await interaction.showModal(modal);
  },
};

export async function handlePotluckModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;

  const name = interaction.fields.getTextInputValue('potluck-name');
  const date = interaction.fields.getTextInputValue('potluck-date') || undefined;
  const theme = interaction.fields.getTextInputValue('potluck-theme') || undefined;
  const itemsText = interaction.fields.getTextInputValue('potluck-items');

  const items: PotluckItem[] = itemsText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(itemName => ({
      id: randomUUID(),
      name: itemName,
      claimedBy: [],
    }));

  const potluck = await storage.createPotluck({
    name,
    date,
    theme,
    createdBy: interaction.user.id,
    guildId: interaction.guild.id,
    channelId: interaction.channel?.id || '',
    items,
  });

  const embed = createPotluckEmbed(potluck);
  const buttons = createPotluckButtons(potluck);

  const reply = await interaction.reply({
    embeds: [embed],
    components: buttons,
    fetchReply: true,
  });

  potluck.messageId = reply.id;
  potluck.messageCreatedAt = new Date();
  await storage.updatePotluck(potluck);

  // No collector setup needed - interactions handled directly
}

function createPotluckEmbed(potluck: any) {
  const embed = new EmbedBuilder()
    .setTitle(`🍽️ ${potluck.name}`)
    .setColor(0x00AE86)
    .setTimestamp(potluck.createdAt);

  let description = `Created by <@${potluck.createdBy}>\n\n`;
  
  if (potluck.date) {
    description += `📅 **Date:** ${potluck.date}\n`;
  }
  
  if (potluck.theme) {
    description += `🎭 **Theme:** ${potluck.theme}\n`;
  }
  
  description += '\n**Items:**\n';
  
  for (const item of potluck.items) {
    const claimText = item.claimedBy.length > 0 
      ? ` - claimed by ${item.claimedBy.map((id: string) => `<@${id}>`).join(', ')}`
      : ' - *available*';
    description += `• ${item.name}${claimText}\n`;
  }

  embed.setDescription(description);
  return embed;
}

function createPotluckButtons(potluck: any) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();
  let buttonsInRow = 0;

  for (const item of potluck.items) {
    if (buttonsInRow === 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
      buttonsInRow = 0;
    }

    const button = new ButtonBuilder()
      .setCustomId(`claim-${item.id}`)
      .setLabel(item.name)
      .setStyle(item.claimedBy.length > 0 ? ButtonStyle.Secondary : ButtonStyle.Primary);

    currentRow.addComponents(button);
    buttonsInRow++;
  }

  if (buttonsInRow > 0) {
    rows.push(currentRow);
  }

  if (rows.length < 5) {
    const addCustomRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('add-custom-item')
        .setLabel('+ Add Custom Item')
        .setStyle(ButtonStyle.Success)
    );
    rows.push(addCustomRow);
  }

  return rows;
}

export async function handlePotluckButtonInteraction(interaction: ButtonInteraction) {
  try {
    // Find the potluck by looking up the message
    const guildPotlucks = await storage.getPotlucksByGuild(interaction.guildId || '');
    const potluck = guildPotlucks.find(p => p.messageId === interaction.message.id);
    
    if (!potluck) {
      await interaction.reply({ 
        content: 'Could not find the potluck associated with this message. The potluck may have been deleted or this is an old message.', 
        ephemeral: true 
      });
      return;
    }

    await handlePotluckButton(interaction, potluck.id);
  } catch (error) {
    console.error('Error in handlePotluckButtonInteraction:', error instanceof Error ? error.message : 'Unknown error');
    
    const errorMessage = 'An error occurred while processing your request. Please try again later.';
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

async function handlePotluckButton(interaction: ButtonInteraction, potluckId: string) {
  const potluck = await storage.getPotluck(potluckId);
  if (!potluck) {
    await interaction.reply({ content: 'Potluck not found!', ephemeral: true });
    return;
  }

  if (interaction.customId === 'add-custom-item') {
    // Don't defer for modal interactions - we need to show the modal directly
    await handleAddCustomItem(interaction, potluckId);
    return;
  }

  // Defer the interaction for claim/unclaim operations to avoid timing issues
  await interaction.deferReply({ ephemeral: true });

  if (interaction.customId.startsWith('claim-')) {
    const itemId = interaction.customId.replace('claim-', '');
    const item = potluck.items.find(i => i.id === itemId);
    
    if (!item) {
      await interaction.editReply({ content: 'Item not found!' });
      return;
    }

    const alreadyClaimed = item.claimedBy.includes(interaction.user.id);
    
    if (alreadyClaimed) {
      await storage.unclaimItem(potluckId, itemId, interaction.user.id);
      await interaction.editReply({ 
        content: `You've unclaimed **${item.name}**`
      });
    } else {
      await storage.claimItem(potluckId, itemId, interaction.user.id);
      
      // Get the updated item to check for other claimants
      const updatedPotluckForResponse = await storage.getPotluck(potluckId);
      const updatedItem = updatedPotluckForResponse?.items.find(i => i.id === itemId);
      
      let responseText = `You've claimed **${item.name}**!`;
      if (updatedItem && updatedItem.claimedBy.length > 1) {
        const others = updatedItem.claimedBy.filter(id => id !== interaction.user.id);
        if (others.length > 0) {
          responseText += `\n⚠️ Also claimed by: ${others.map(id => `<@${id}>`).join(', ')}`;
        }
      }
      
      await interaction.editReply({ 
        content: responseText
      });
    }

    // Small delay to avoid race conditions with Discord
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await updatePotluckDisplay(potluckId, interaction.channel);
  }
}

async function handleAddCustomItem(interaction: ButtonInteraction, potluckId: string) {
  const modal = new ModalBuilder()
    .setCustomId(`add-custom-${potluckId}`)
    .setTitle('Add Custom Item');

  const itemInput = new TextInputBuilder()
    .setCustomId('custom-item-name')
    .setLabel('Item Name')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const claimInput = new TextInputBuilder()
    .setCustomId('custom-item-claim')
    .setLabel('Claim this item for yourself?')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('Type "yes" to claim it automatically')
    .setMaxLength(10);

  const itemRow = new ActionRowBuilder<TextInputBuilder>().addComponents(itemInput);
  const claimRow = new ActionRowBuilder<TextInputBuilder>().addComponents(claimInput);

  modal.addComponents(itemRow, claimRow);

  await interaction.showModal(modal);
}

export async function handleAddCustomModal(interaction: ModalSubmitInteraction) {
  const potluckId = interaction.customId.replace('add-custom-', '');
  const itemName = interaction.fields.getTextInputValue('custom-item-name');
  const shouldClaim = interaction.fields.getTextInputValue('custom-item-claim').toLowerCase() === 'yes';

  try {
    await storage.addCustomItem(
      potluckId, 
      itemName, 
      shouldClaim ? interaction.user.id : undefined
    );

    await updatePotluckDisplay(potluckId, interaction.channel);

    const responseText = shouldClaim 
      ? `Added **${itemName}** and claimed it for you!`
      : `Added **${itemName}** to the potluck!`;
    
    await interaction.reply({ 
      content: responseText, 
      flags: MessageFlags.Ephemeral 
    });
  } catch (error) {
    console.log('Error adding custom item:', error instanceof Error ? error.message : 'Unknown error');
    await interaction.reply({ 
      content: 'Failed to add custom item!', 
      flags: MessageFlags.Ephemeral 
    });
  }
}

// Collector recovery is no longer needed since interactions are handled directly