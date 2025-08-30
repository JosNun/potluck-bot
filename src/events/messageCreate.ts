import { Events, Message } from 'discord.js';
import { createEventLogger } from '../utils/logger';

export default {
  name: Events.MessageCreate,
  async execute(message: Message) {
    if (message.author.bot) return;
    
    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const logger = createEventLogger('message_create', {
      messageId: message.id,
      channelId: message.channelId,
      guildId: message.guild?.id,
      userId: message.author.id
    });

    try {
      switch (commandName) {
        case 'ping':
          await message.reply('Pong! 🏓');
          logger.info({
            event: 'text_command_executed',
            commandName: 'ping',
            userTag: message.author.tag,
            responseType: 'pong'
          }, 'User executed ping command');
          break;
        
        case 'hello':
          await message.reply(`Hello ${message.author.displayName}! 👋`);
          logger.info({
            event: 'text_command_executed',
            commandName: 'hello',
            userTag: message.author.tag,
            displayName: message.author.displayName
          }, 'User executed hello command');
          break;
        
        case 'info':
          await message.reply(`Bot running with ${message.client.guilds.cache.size} servers and ${message.client.users.cache.size} users cached.`);
          logger.info({
            event: 'text_command_executed',
            commandName: 'info',
            userTag: message.author.tag,
            serverCount: message.client.guilds.cache.size,
            userCount: message.client.users.cache.size
          }, 'User executed info command');
          break;
        
        default:
          await message.reply(`Unknown command: \`${commandName}\`. Available commands: \`ping\`, \`hello\`, \`info\``);
      }
    } catch (error) {
      logger.error({
        err: error,
        event: 'text_command_error',
        commandName,
        userTag: message.author.tag
      }, `Error executing text command ${commandName}`);
      await message.reply('There was an error executing that command!');
    }
  },
};