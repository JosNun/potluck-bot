import { Client, Collection, GatewayIntentBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { Command } from './types';
import { createBotLogger } from './utils/logger';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const logger = createBotLogger();

client.commands = new Collection<string, Command>();

const getEnvironmentConfig = () => {
  const isDev = process.env.NODE_ENV !== 'production';
  const fileExtension = isDev ? '.ts' : '.js';
  const baseDir = isDev ? path.join(__dirname, '..', 'src') : __dirname;
  
  return { isDev, fileExtension, baseDir };
};

const loadCommands = async () => {
  const { fileExtension, baseDir } = getEnvironmentConfig();
  const commandsPath = path.join(baseDir, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(fileExtension));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(filePath);
    if ('data' in command.default && 'execute' in command.default) {
      client.commands.set(command.default.data.name, command.default);
      logger.info({
        event: 'command_loaded',
        commandName: command.default.data.name,
        filePath
      }, 'Command loaded successfully');
    } else {
      logger.warn({
        event: 'command_load_failed',
        filePath,
        reason: 'missing_required_properties'
      }, 'Command missing required "data" or "execute" property');
    }
  }
};

const loadEvents = async () => {
  const { fileExtension, baseDir } = getEnvironmentConfig();
  const eventsPath = path.join(baseDir, 'events');
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(fileExtension));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = await import(filePath);
    if (event.default.once) {
      client.once(event.default.name, (...args) => event.default.execute(...args));
    } else {
      client.on(event.default.name, (...args) => event.default.execute(...args));
    }
    logger.info({
      event: 'event_listener_loaded',
      eventName: event.default.name,
      filePath,
      once: event.default.once || false
    }, 'Event listener loaded successfully');
  }
};

const main = async () => {
  try {
    await loadCommands();
    await loadEvents();
    
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    logger.error({
      err: error,
      event: 'bot_startup_failed'
    }, 'Failed to start bot');
    process.exit(1);
  }
};

main();