import { Events, Client } from 'discord.js';
import { createEventLogger } from '../utils/logger';

export default {
  name: Events.ClientReady,
  once: true,
  execute(client: Client) {
    if (!client.user) return;
    
    const logger = createEventLogger('client_ready', {
      botId: client.user.id,
      botTag: client.user.tag
    });
    
    logger.info({
      event: 'bot_ready',
      botTag: client.user.tag,
      guildCount: client.guilds.cache.size,
      userCount: client.users.cache.size
    }, 'Bot is ready and logged in');
    
    logger.info({
      event: 'bot_guild_stats',
      guildCount: client.guilds.cache.size,
      totalMembers: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)
    }, `Bot is active in ${client.guilds.cache.size} server(s)`);
  },
};