import {
  GuildScheduledEvent,
  GuildScheduledEventCreateOptions,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventStatus,
  Client,
  PermissionFlagsBits,
} from 'discord.js';
import { Potluck } from '../storage/potluck';
import { StorageFactory } from '../storage/storage-factory';
import { createBotLogger } from '../utils/logger';

const logger = createBotLogger();
const storage = StorageFactory.getStorage();

export class DiscordEventsService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Checks if the bot has the necessary permissions to manage events in a guild
   */
  private async checkEventPermissions(guildId: string): Promise<{ hasPermission: boolean; missingPermissions: string[] }> {
    try {
      logger.info({ guildId }, 'Fetching guild for permission check...');
      const guild = await this.client.guilds.fetch(guildId);
      if (!guild) {
        logger.warn({ guildId }, 'Guild not found during permission check');
        return { hasPermission: false, missingPermissions: ['Guild not found'] };
      }

      logger.info({ guildId, botId: this.client.user!.id }, 'Fetching bot member for permission check...');
      const botMember = await guild.members.fetch(this.client.user!.id);
      if (!botMember) {
        logger.warn({ guildId, botId: this.client.user!.id }, 'Bot member not found in guild');
        return { hasPermission: false, missingPermissions: ['Bot not in guild'] };
      }

      const missingPermissions: string[] = [];
      
      // Check for Manage Events permission
      const hasManageEvents = botMember.permissions.has(PermissionFlagsBits.ManageEvents);
      logger.info({ guildId, hasManageEvents }, 'Checked ManageEvents permission');
      if (!hasManageEvents) {
        missingPermissions.push('Manage Events');
      }

      // Check for Send Messages permission (needed for updating event descriptions)
      const hasSendMessages = botMember.permissions.has(PermissionFlagsBits.SendMessages);
      logger.info({ guildId, hasSendMessages }, 'Checked SendMessages permission');
      if (!hasSendMessages) {
        missingPermissions.push('Send Messages');
      }

      logger.info({ 
        guildId, 
        hasManageEvents, 
        hasSendMessages, 
        missingPermissions,
        totalPermissions: botMember.permissions.bitfield.toString()
      }, 'Permission check details');

      return {
        hasPermission: missingPermissions.length === 0,
        missingPermissions,
      };
    } catch (error) {
      logger.error({
        err: error,
        guildId,
      }, 'Failed to check event permissions');
      
      return { hasPermission: false, missingPermissions: ['Permission check failed'] };
    }
  }

  /**
   * Creates a Discord scheduled event for a potluck
   */
  async createEventForPotluck(potluck: Potluck, options?: {
    startTime?: Date;
    endTime?: Date;
    location?: string;
    enableRsvpSync?: boolean;
  }): Promise<GuildScheduledEvent | null> {
    try {
      // Check permissions first
      logger.info({ potluckId: potluck.id, guildId: potluck.guildId }, 'Starting Discord event creation - checking permissions...');
      
      const permissionCheck = await this.checkEventPermissions(potluck.guildId);
      
      logger.info({ 
        potluckId: potluck.id, 
        guildId: potluck.guildId,
        hasPermission: permissionCheck.hasPermission,
        missingPermissions: permissionCheck.missingPermissions
      }, 'Permission check completed');
      
      if (!permissionCheck.hasPermission) {
        logger.error({ 
          potluckId: potluck.id, 
          guildId: potluck.guildId,
          missingPermissions: permissionCheck.missingPermissions
        }, 'Missing permissions to create Discord event - throwing PermissionError');
        
        // Throw a specific error that can be caught and handled by the calling code
        const error = new Error(`Missing permissions: ${permissionCheck.missingPermissions.join(', ')}`);
        error.name = 'PermissionError';
        throw error;
      }

      const guild = await this.client.guilds.fetch(potluck.guildId);
      if (!guild) {
        logger.error({ potluckId: potluck.id, guildId: potluck.guildId }, 'Guild not found for potluck');
        return null;
      }

      // Default to 2 hours from now if no start time provided
      const startTime = options?.startTime || new Date(Date.now() + 2 * 60 * 60 * 1000);
      // Default to 3 hours duration if no end time provided
      const endTime = options?.endTime || new Date(startTime.getTime() + 3 * 60 * 60 * 1000);

      const eventOptions: GuildScheduledEventCreateOptions = {
        name: potluck.name,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
        entityType: GuildScheduledEventEntityType.External, // Potlucks are physical events, not Discord voice events
        description: this.buildEventDescription(potluck),
        entityMetadata: {
          location: options?.location || 'TBD - Check potluck details for location',
        },
      };

      logger.info({ 
        potluckId: potluck.id,
        eventType: 'External',
        location: eventOptions.entityMetadata?.location
      }, 'Creating external event for potluck');

      const event = await guild.scheduledEvents.create(eventOptions);

      // Update the potluck with the Discord event information
      await storage.updateDiscordEvent(
        potluck.id,
        event.id,
        startTime,
        endTime,
        options?.enableRsvpSync || false
      );

      logger.info({
        potluckId: potluck.id,
        eventId: event.id,
        eventName: event.name,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      }, 'Discord event created for potluck');

      return event;
    } catch (error) {
      logger.error({
        err: error,
        potluckId: potluck.id,
        guildId: potluck.guildId,
      }, 'Failed to create Discord event for potluck');
      return null;
    }
  }

  /**
   * Updates an existing Discord event based on potluck changes
   */
  async updateEventFromPotluck(potluck: Potluck): Promise<boolean> {
    if (!potluck.discordEventId) {
      return false;
    }

    try {
      // Check permissions first
      const permissionCheck = await this.checkEventPermissions(potluck.guildId);
      if (!permissionCheck.hasPermission) {
        logger.warn({ 
          potluckId: potluck.id, 
          guildId: potluck.guildId,
          missingPermissions: permissionCheck.missingPermissions
        }, 'Missing permissions to update Discord event');
        return false;
      }

      const guild = await this.client.guilds.fetch(potluck.guildId);
      if (!guild) {
        logger.error({ potluckId: potluck.id, guildId: potluck.guildId }, 'Guild not found for potluck update');
        return false;
      }

      const event = await guild.scheduledEvents.fetch(potluck.discordEventId);
      if (!event) {
        logger.warn({ potluckId: potluck.id, eventId: potluck.discordEventId }, 'Discord event not found for update');
        return false;
      }

      // Only update if the event is not active or completed
      if (event.status === GuildScheduledEventStatus.Active || event.status === GuildScheduledEventStatus.Completed) {
        logger.info({ potluckId: potluck.id, eventId: event.id, status: event.status }, 'Cannot update active or completed event');
        return false;
      }

      await event.edit({
        name: potluck.name,
        description: this.buildEventDescription(potluck),
        scheduledStartTime: potluck.eventStartTime || event.scheduledStartAt || undefined,
        scheduledEndTime: potluck.eventEndTime || event.scheduledEndAt || undefined,
      });

      logger.info({
        potluckId: potluck.id,
        eventId: event.id,
        eventName: event.name,
      }, 'Discord event updated from potluck');

      return true;
    } catch (error) {
      logger.error({
        err: error,
        potluckId: potluck.id,
        eventId: potluck.discordEventId,
      }, 'Failed to update Discord event from potluck');
      return false;
    }
  }

  /**
   * Deletes a Discord event associated with a potluck
   */
  async deleteEventForPotluck(potluck: Potluck): Promise<boolean> {
    if (!potluck.discordEventId) {
      return false;
    }

    try {
      const guild = await this.client.guilds.fetch(potluck.guildId);
      if (!guild) {
        logger.error({ potluckId: potluck.id, guildId: potluck.guildId }, 'Guild not found for event deletion');
        return false;
      }

      const event = await guild.scheduledEvents.fetch(potluck.discordEventId);
      if (!event) {
        logger.warn({ potluckId: potluck.id, eventId: potluck.discordEventId }, 'Discord event not found for deletion');
        return false;
      }

      await event.delete();

      // Clear the Discord event information from the potluck
      await storage.updateDiscordEvent(potluck.id, '', undefined, undefined, false);

      logger.info({
        potluckId: potluck.id,
        eventId: potluck.discordEventId,
      }, 'Discord event deleted for potluck');

      return true;
    } catch (error) {
      logger.error({
        err: error,
        potluckId: potluck.id,
        eventId: potluck.discordEventId,
      }, 'Failed to delete Discord event for potluck');
      return false;
    }
  }

  /**
   * Syncs potluck data with Discord event updates
   */
  async syncPotluckFromEvent(event: GuildScheduledEvent): Promise<boolean> {
    try {
      const potluck = await storage.getPotluckByEventId(event.id);
      if (!potluck) {
        logger.warn({ eventId: event.id }, 'No potluck found for Discord event');
        return false;
      }

      // Update potluck with event changes
      const updatedPotluck = {
        ...potluck,
        name: event.name,
        eventStartTime: event.scheduledStartAt ? new Date(event.scheduledStartAt) : undefined,
        eventEndTime: event.scheduledEndAt ? new Date(event.scheduledEndAt) : undefined,
      };

      await storage.updatePotluck(updatedPotluck);

      logger.info({
        potluckId: potluck.id,
        eventId: event.id,
      }, 'Potluck synced from Discord event update');

      return true;
    } catch (error) {
      logger.error({
        err: error,
        eventId: event.id,
      }, 'Failed to sync potluck from Discord event');
      return false;
    }
  }

  /**
   * Gets participants from a Discord event
   */
  async getEventParticipants(eventId: string, guildId: string): Promise<string[]> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      if (!guild) {
        return [];
      }

      const event = await guild.scheduledEvents.fetch(eventId);
      if (!event) {
        return [];
      }

      const subscribers = await event.fetchSubscribers();
      return subscribers.map(subscription => subscription.user.id);
    } catch (error) {
      logger.error({
        err: error,
        eventId,
        guildId,
      }, 'Failed to get event participants');
      return [];
    }
  }

  /**
   * Builds the event description from potluck data
   */
  private buildEventDescription(potluck: Potluck): string {
    let description = `🍽️ **${potluck.name}**\n\n`;
    
    if (potluck.date) {
      description += `📅 **When:** ${potluck.date}\n`;
    }
    
    if (potluck.theme) {
      description += `🎭 **Theme:** ${potluck.theme}\n`;
    }
    
    description += '\n**Items needed:**\n';
    
    // Show first few items, with count if there are more
    const itemsToShow = potluck.items.slice(0, 10);
    for (const item of itemsToShow) {
      const status = item.claimedBy.length > 0 ? '✅' : '⏳';
      description += `${status} ${item.name}\n`;
    }
    
    if (potluck.items.length > 10) {
      description += `\n... and ${potluck.items.length - 10} more items\n`;
    }
    
    description += `\nSee the potluck message in <#${potluck.channelId}> for full details and to claim items!`;
    
    // Keep under Discord's description limit
    if (description.length > 1000) {
      description = description.substring(0, 997) + '...';
    }
    
    return description;
  }
}