import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';
import { StorageFactory } from '../storage/storage-factory';
import { createBotLogger } from '../utils/logger';

const storage = StorageFactory.getStorage();
const logger = createBotLogger();

const COMMON_TIMEZONES = [
  { name: 'Eastern Time (EST/EDT)', value: 'America/New_York' },
  { name: 'Central Time (CST/CDT)', value: 'America/Chicago' },
  { name: 'Mountain Time (MST/MDT)', value: 'America/Denver' },
  { name: 'Pacific Time (PST/PDT)', value: 'America/Los_Angeles' },
  { name: 'Alaska Time (AKST/AKDT)', value: 'America/Anchorage' },
  { name: 'Hawaii Time (HST)', value: 'Pacific/Honolulu' },
  { name: 'Atlantic Time (AST/ADT)', value: 'America/Halifax' },
  { name: 'UTC', value: 'UTC' },
];

export default {
  data: new SlashCommandBuilder()
    .setName('settimezone')
    .setDescription('Set the default timezone for potluck events in this server (Admin only)')
    .addStringOption(option =>
      option.setName('timezone')
        .setDescription('Select a timezone')
        .setRequired(true)
        .addChoices(...COMMON_TIMEZONES))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ 
        content: 'This command can only be used in servers.', 
        flags: MessageFlags.Ephemeral 
      });
      return;
    }

    // Double-check permissions
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ 
        content: 'You need the "Manage Server" permission to use this command.', 
        flags: MessageFlags.Ephemeral 
      });
      return;
    }

    const timezone = interaction.options.getString('timezone', true);
    const timezoneName = COMMON_TIMEZONES.find(tz => tz.value === timezone)?.name || timezone;

    try {
      const settings = await storage.setGuildTimezone(
        interaction.guild.id, 
        timezone, 
        interaction.user.id
      );

      logger.info({
        guildId: interaction.guild.id,
        timezone: settings.timezone,
        updatedBy: settings.updatedBy,
      }, 'Guild timezone updated');

      // Get current time in the selected timezone for confirmation
      const now = new Date();
      const currentTimeInTz = now.toLocaleString('en-US', { 
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      });

      await interaction.reply({
        content: `✅ Server timezone set to **${timezoneName}**\n\nCurrent time: ${currentTimeInTz}\n\nThis will be used as the default timezone for all new potluck events. Users can still specify a different timezone when creating events (e.g., "6pm PST").`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error({
        err: error,
        guildId: interaction.guild.id,
        timezone,
        userId: interaction.user.id,
      }, 'Failed to set guild timezone');

      await interaction.reply({
        content: 'Failed to update timezone settings. Please try again.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};