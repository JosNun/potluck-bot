import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { createBotLogger } from './utils/logger';

const commands: any[] = [];
const logger = createBotLogger();

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
      commands.push(command.default.data.toJSON());
      logger.info({
        event: 'command_loaded_for_deploy',
        commandName: command.default.data.name,
        filePath
      }, 'Command loaded for deployment');
    } else {
      logger.warn({
        event: 'command_load_failed',
        filePath,
        reason: 'missing_required_properties'
      }, 'Command missing required "data" or "execute" property');
    }
  }
};

const deployCommands = async () => {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

  try {
    logger.info({
      event: 'command_deploy_started',
      commandCount: commands.length,
      clientId: process.env.CLIENT_ID
    }, 'Started refreshing application commands');

    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!),
      { body: commands },
    );

    logger.info({
      event: 'command_deploy_success',
      deployedCount: (data as any[]).length,
      requestedCount: commands.length
    }, 'Successfully reloaded application commands');
  } catch (error) {
    logger.error({
      err: error,
      event: 'command_deploy_failed',
      commandCount: commands.length
    }, 'Failed to deploy commands');
  }
};

const main = async () => {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    logger.error({
      event: 'missing_env_variables',
      missingToken: !process.env.DISCORD_TOKEN,
      missingClientId: !process.env.CLIENT_ID
    }, 'Missing required environment variables');
    process.exit(1);
  }

  await loadCommands();
  await deployCommands();
};

main();