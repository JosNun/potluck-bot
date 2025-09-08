import { Events, GuildScheduledEvent } from 'discord.js';
import { StorageFactory } from '../storage/storage-factory';
import { createBotLogger } from '../utils/logger';

const logger = createBotLogger();
const storage = StorageFactory.getStorage();

export default {
  name: Events.GuildScheduledEventDelete,
  async execute(scheduledEvent: GuildScheduledEvent) {
    try {
      if (!scheduledEvent.guild) {
        logger.warn({ eventId: scheduledEvent.id }, 'Guild not available for scheduled event delete');
        return;
      }

      logger.info({
        eventId: scheduledEvent.id,
        eventName: scheduledEvent.name,
        guildId: scheduledEvent.guild.id,
      }, 'Discord scheduled event deleted');

      // Find the associated potluck and clear the Discord event reference
      const potluck = await storage.getPotluckByEventId(scheduledEvent.id);
      if (potluck) {
        await storage.updateDiscordEvent(potluck.id, '', undefined, undefined, false);
        
        logger.info({
          potluckId: potluck.id,
          eventId: scheduledEvent.id,
        }, 'Cleared Discord event reference from potluck');
      }

    } catch (error) {
      logger.error({
        err: error,
        eventId: scheduledEvent.id,
        guildId: scheduledEvent.guild?.id,
      }, 'Error handling guild scheduled event delete');
    }
  },
};