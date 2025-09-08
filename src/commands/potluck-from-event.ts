import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  ModalSubmitInteraction,
  AutocompleteInteraction
} from 'discord.js';
import { randomUUID } from 'crypto';
import { StorageFactory } from '../storage/storage-factory';
import { PotluckItem } from '../storage/potluck';
import { DiscordEventsService } from '../services/discord-events.service';
import { createPotluckEmbed, createPotluckButtons } from './potluck';
import { formatEventDate } from '../utils/date-parser';

const storage = StorageFactory.getStorage();

export default {
  data: new SlashCommandBuilder()
    .setName('potluck-from-event')
    .setDescription('Create a potluck from an existing Discord scheduled event')
    .addStringOption(option =>
      option.setName('event')
        .setDescription('Select a Discord scheduled event')
        .setRequired(true)
        .setAutocomplete(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in servers.', ephemeral: true });
      return;
    }

    const eventId = interaction.options.getString('event', true);
    
    try {
      // Fetch the Discord event
      const event = await interaction.guild.scheduledEvents.fetch(eventId);
      if (!event) {
        await interaction.reply({ content: 'Discord event not found.', ephemeral: true });
        return;
      }

      // Check if a potluck already exists for this event
      const existingPotluck = await storage.getPotluckByEventId(eventId);
      if (existingPotluck) {
        await interaction.reply({ 
          content: `A potluck already exists for this event! Check <#${existingPotluck.channelId}> for the potluck message.`, 
          ephemeral: true 
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

      const locationInput = new TextInputBuilder()
        .setCustomId('potluck-location')
        .setLabel('Location override (optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('Leave empty to use event location')
        .setMaxLength(200);

      const themeRow = new ActionRowBuilder<TextInputBuilder>().addComponents(themeInput);
      const itemsRow = new ActionRowBuilder<TextInputBuilder>().addComponents(itemsInput);
      const locationRow = new ActionRowBuilder<TextInputBuilder>().addComponents(locationInput);

      modal.addComponents(themeRow, itemsRow, locationRow);

      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error fetching Discord event:', error);
      await interaction.reply({ 
        content: 'Failed to fetch the Discord event. Please try again.', 
        ephemeral: true 
      });
    }
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

export async function handlePotluckFromEventModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;

  const eventId = interaction.customId.replace('potluck-from-event-', '');
  const theme = interaction.fields.getTextInputValue('potluck-theme') || undefined;
  const itemsText = interaction.fields.getTextInputValue('potluck-items');
  const _locationOverride = interaction.fields.getTextInputValue('potluck-location') || undefined;

  try {
    // Fetch the Discord event again to get current data
    const event = await interaction.guild.scheduledEvents.fetch(eventId);
    if (!event) {
      await interaction.reply({ content: 'Discord event no longer exists.', ephemeral: true });
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
        ephemeral: true,
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
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error('Error creating potluck from event:', error);
    
    const errorMessage = 'Failed to create potluck from Discord event. Please try again.';
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}