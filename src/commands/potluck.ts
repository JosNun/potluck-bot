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
  MessageFlags,
  AutocompleteInteraction
} from 'discord.js';
import { randomUUID } from 'crypto';
import { StorageFactory } from '../storage/storage-factory';
import { PotluckItem } from '../storage/potluck';
import { DiscordEventsService } from '../services/discord-events.service';
import { parsePotluckEventDate, formatEventDate, getDateExamples } from '../utils/date-parser';

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

  // Sync with Discord event if one exists
  if (potluck.discordEventId && channel.client) {
    try {
      const eventsService = new DiscordEventsService(channel.client);
      await eventsService.updateEventFromPotluck(potluck);
    } catch (error) {
      console.log('Error syncing Discord event:', error instanceof Error ? error.message : 'Unknown error');
    }
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
    .setDescription('Create and manage potluck events')
    .addStringOption(option =>
      option.setName('event')
        .setDescription('Select an existing Discord scheduled event (optional)')
        .setRequired(false)
        .setAutocomplete(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    const eventId = interaction.options.getString('event');
    
    // If event is provided, handle as potluck-from-event
    if (eventId) {
      return await handlePotluckFromEvent(interaction, eventId);
    }
    
    // Otherwise, handle as regular potluck creation
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
      .setLabel('Date & Time (optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder('Creates Discord event if provided. e.g., Saturday at 6pm, Dec 14th')
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

  async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guild) return;

    const focusedValue = interaction.options.getFocused().toLowerCase();

    try {
      // Fetch all scheduled events for the guild
      const events = await interaction.guild.scheduledEvents.fetch();
      
      // Filter events that are scheduled (not active, completed, or cancelled)
      const activeEvents = events.filter(event => 
        event.status === 1 && // GuildScheduledEventStatus.Scheduled
        event.name.toLowerCase().includes(focusedValue)
      );

      // Return up to 25 choices (Discord's limit)
      const choices = activeEvents
        .first(25)
        .map(event => ({
          name: `${event.name} (${event.scheduledStartAt?.toLocaleDateString()})`,
          value: event.id,
        }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Error in autocomplete:', error);
      await interaction.respond([]);
    }
  },
};

async function handlePotluckFromEvent(interaction: ChatInputCommandInteraction, eventId: string) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in servers.', flags: MessageFlags.Ephemeral });
    return;
  }
  
  try {
    // Fetch the Discord event
    const event = await interaction.guild.scheduledEvents.fetch(eventId);
    if (!event) {
      await interaction.reply({ content: 'Discord event not found.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Check if a potluck already exists for this event
    const existingPotluck = await storage.getPotluckByEventId(eventId);
    if (existingPotluck) {
      await interaction.reply({ 
        content: `A potluck already exists for this event! Check <#${existingPotluck.channelId}> for the potluck message.`, 
        flags: MessageFlags.Ephemeral 
      });
      return;
    }

    // Show modal to collect additional potluck details
    const modal = new ModalBuilder()
      .setCustomId(`potluck-from-event-${eventId}`)
      .setTitle('Create Potluck from Event');

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

    const themeRow = new ActionRowBuilder<TextInputBuilder>().addComponents(themeInput);
    const itemsRow = new ActionRowBuilder<TextInputBuilder>().addComponents(itemsInput);

    modal.addComponents(themeRow, itemsRow);

    await interaction.showModal(modal);
  } catch (error) {
    console.error('Error fetching Discord event:', error);
    await interaction.reply({ 
      content: 'Failed to fetch the Discord event. Please try again.', 
      flags: MessageFlags.Ephemeral 
    });
  }
}

export async function handlePotluckFromEventModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;

  const eventId = interaction.customId.replace('potluck-from-event-', '');
  const theme = interaction.fields.getTextInputValue('potluck-theme') || undefined;
  const itemsText = interaction.fields.getTextInputValue('potluck-items');

  try {
    // Fetch the Discord event again to get current data
    const event = await interaction.guild.scheduledEvents.fetch(eventId);
    if (!event) {
      await interaction.reply({ content: 'Discord event no longer exists.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Parse items from input
    const items: PotluckItem[] = itemsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(itemName => ({
        id: randomUUID(),
        name: itemName,
        claimedBy: [],
      }));

    // Extract date from event using our consistent formatter
    const { formatEventDate } = await import('../utils/date-parser');
    const eventDate = event.scheduledStartAt ? formatEventDate(new Date(event.scheduledStartAt)) : undefined;

    // Create the potluck
    const potluck = await storage.createPotluck({
      name: event.name,
      date: eventDate,
      theme,
      createdBy: interaction.user.id,
      guildId: interaction.guild.id,
      channelId: interaction.channel?.id || '',
      discordEventId: eventId,
      eventStartTime: event.scheduledStartAt ? new Date(event.scheduledStartAt) : undefined,
      eventEndTime: event.scheduledEndAt ? new Date(event.scheduledEndAt) : undefined,
      rsvpSyncEnabled: true,
      items,
    });

    const embed = createPotluckEmbed(potluck);
    const buttons = createPotluckButtons(potluck);

    const reply = await interaction.reply({
      embeds: [embed],
      components: buttons,
      fetchReply: true,
    });

    // Update potluck with message info
    potluck.messageId = reply.id;
    potluck.messageCreatedAt = new Date();
    await storage.updatePotluck(potluck);

    // Update the Discord event description to reference the potluck
    try {
      const eventsService = new DiscordEventsService(interaction.client);
      await eventsService.updateEventFromPotluck(potluck);
      
      await interaction.followUp({
        content: `✅ Potluck created from Discord event "${event.name}"! The event description has been updated with potluck details.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error('Error updating Discord event:', error);
      
      let errorMessage = '✅ Potluck created successfully! However, could not update the Discord event description.';
      
      if (error instanceof Error) {
        if (error.name === 'PermissionError' || error.message.includes('Missing Permissions')) {
          errorMessage = '✅ Potluck created successfully! However, I don\'t have permission to update the Discord event description. ' +
                        'Ask a server admin to give me the **"Manage Events"** permission for full synchronization.';
        }
      }
      
      await interaction.followUp({
        content: errorMessage,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    console.error('Error creating potluck from event:', error);
    
    const errorMessage = 'Failed to create potluck from Discord event. Please try again.';
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
    }
  }
}

export async function handlePotluckModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;

  const name = interaction.fields.getTextInputValue('potluck-name');
  const date = interaction.fields.getTextInputValue('potluck-date') || undefined;
  const theme = interaction.fields.getTextInputValue('potluck-theme') || undefined;
  const itemsText = interaction.fields.getTextInputValue('potluck-items');
  const createEvent = !!date;

  const items: PotluckItem[] = itemsText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(itemName => ({
      id: randomUUID(),
      name: itemName,
      claimedBy: [],
    }));

  let discordEvent = null;
  let parsedDate = null;
  let eventCreationError = null;

  // Create Discord event first if requested
  if (createEvent) {
    try {
      const eventsService = new DiscordEventsService(interaction.client);
      
      // Parse date using robust date parser with guild timezone
      parsedDate = await parsePotluckEventDate(date, { 
        guildId: interaction.guild.id
      });
      
      // Create a temporary potluck object for event creation
      const tempPotluck = {
        id: randomUUID(),
        name,
        theme,
        createdBy: interaction.user.id,
        guildId: interaction.guild.id,
        channelId: interaction.channel?.id || '',
        items,
        createdAt: new Date(),
      };
      
      discordEvent = await eventsService.createEventForPotluck(tempPotluck, {
        startTime: parsedDate.startTime,
        endTime: parsedDate.endTime,
        enableRsvpSync: true,
      });
    } catch (error) {
      console.error('Error creating Discord event:', error);
      eventCreationError = error;
      // Continue with potluck creation even if event creation fails
    }
  }

  // Create potluck with Discord event info if available
  const potluck = await storage.createPotluck({
    name,
    date,
    theme,
    createdBy: interaction.user.id,
    guildId: interaction.guild.id,
    channelId: interaction.channel?.id || '',
    discordEventId: discordEvent?.id,
    eventStartTime: discordEvent?.scheduledStartAt ? new Date(discordEvent.scheduledStartAt) : undefined,
    eventEndTime: discordEvent?.scheduledEndAt ? new Date(discordEvent.scheduledEndAt) : undefined,
    rsvpSyncEnabled: !!discordEvent,
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

  // Send follow-up messages about event creation
  if (createEvent) {
    if (discordEvent && parsedDate) {
      // Success - event was created
      let successMessage = `✅ Discord event "${discordEvent.name}" created!`;
      
      if (parsedDate.parseMethod === 'default') {
        successMessage += ` Used default time (${formatEventDate(parsedDate.startTime)}).`;
      } else if (parsedDate.wasAmbiguous) {
        successMessage += ` Interpreted "${parsedDate.originalInput}" as ${formatEventDate(parsedDate.startTime)}.`;
      }

      await interaction.followUp({
        content: successMessage,
        flags: MessageFlags.Ephemeral,
      });
    } else if (eventCreationError) {
      // Error occurred during event creation
      const error = eventCreationError;
      let errorMessage = '⚠️ Could not create Discord event, but your potluck was created successfully.';
      
      if (error instanceof Error) {
        if (error.name === 'PermissionError') {
          errorMessage = '⚠️ I don\'t have permission to create Discord events. Please ask a server admin to give me the **"Manage Events"** permission.\n\n' +
                        'Your potluck was still created successfully!';
        } else if (error.message.includes('Missing Permissions')) {
          errorMessage = '⚠️ Missing Discord permissions. Please ask a server admin to give me the **"Manage Events"** permission to create scheduled events.\n\n' +
                        'Your potluck was still created successfully!';
        } else if (date && error.message.includes('date')) {
          errorMessage += ` The date "${date}" might not be in a recognized format. Try formats like: ${getDateExamples().slice(0, 2).join(', ')}.`;
        }
      }
      
      await interaction.followUp({
        content: errorMessage,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      // This shouldn't happen, but handle the case where no event was created and no error
      await interaction.followUp({
        content: '⚠️ Could not create Discord event, but your potluck was created successfully.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  // No collector setup needed - interactions handled directly
}

export function createPotluckEmbed(potluck: any) {
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

  if (potluck.discordEventId) {
    const eventUrl = `https://discord.com/events/${potluck.guildId}/${potluck.discordEventId}`;
    description += `🎉 **Discord Event:** [View Event](${eventUrl})\n`;
    if (potluck.eventStartTime) {
      description += `⏰ **Event Time:** <t:${Math.floor(potluck.eventStartTime.getTime() / 1000)}:F>\n`;
    }
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

export function createPotluckButtons(potluck: any) {
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
        flags: MessageFlags.Ephemeral 
      });
      return;
    }

    await handlePotluckButton(interaction, potluck.id);
  } catch (error) {
    console.error('Error in handlePotluckButtonInteraction:', error instanceof Error ? error.message : 'Unknown error');
    
    const errorMessage = 'An error occurred while processing your request. Please try again later.';
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
    }
  }
}

async function handlePotluckButton(interaction: ButtonInteraction, potluckId: string) {
  const potluck = await storage.getPotluck(potluckId);
  if (!potluck) {
    await interaction.reply({ content: 'Potluck not found!', flags: MessageFlags.Ephemeral });
    return;
  }

  if (interaction.customId === 'add-custom-item') {
    // Don't defer for modal interactions - we need to show the modal directly
    await handleAddCustomItem(interaction, potluckId);
    return;
  }

  // Defer the interaction for claim/unclaim operations to avoid timing issues
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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