import { Events, GuildScheduledEvent } from 'discord.js';
import { DiscordEventsService } from '../services/discord-events.service';
import { createBotLogger } from '../utils/logger';

const logger = createBotLogger();

export default {
  name: Events.GuildScheduledEventUpdate,
  async execute(oldEvent: GuildScheduledEvent | null, newEvent: GuildScheduledEvent) {
    try {
      if (!newEvent.guild) {
        logger.warn({ eventId: newEvent.id }, 'Guild not available for scheduled event update');
        return;
      }

      logger.info({
        eventId: newEvent.id,
        eventName: newEvent.name,
        guildId: newEvent.guild.id,
        status: newEvent.status,
      }, 'Discord scheduled event updated');

      const eventsService = new DiscordEventsService(newEvent.client);
      await eventsService.syncPotluckFromEvent(newEvent);

    } catch (error) {
      logger.error({
        err: error,
        eventId: newEvent.id,
        guildId: newEvent.guild?.id,
      }, 'Error handling guild scheduled event update');
    }
  },
};