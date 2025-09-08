import { Events, GuildScheduledEvent, User } from 'discord.js';
import { createBotLogger } from '../utils/logger';

const logger = createBotLogger();

export default {
  name: Events.GuildScheduledEventUserAdd,
  async execute(scheduledEvent: GuildScheduledEvent, user: User) {
    try {
      if (!scheduledEvent.guild) {
        logger.warn({ eventId: scheduledEvent.id, userId: user.id }, 'Guild not available for scheduled event user add');
        return;
      }

      logger.info({
        eventId: scheduledEvent.id,
        eventName: scheduledEvent.name,
        userId: user.id,
        userTag: user.tag,
        guildId: scheduledEvent.guild.id,
      }, 'User added to Discord scheduled event');

      // Future enhancement: Could automatically add user to potluck participants
      // or sync RSVP status with potluck claims if RSVP sync is enabled

    } catch (error) {
      logger.error({
        err: error,
        eventId: scheduledEvent.id,
        userId: user.id,
        guildId: scheduledEvent.guild?.id,
      }, 'Error handling guild scheduled event user add');
    }
  },
};