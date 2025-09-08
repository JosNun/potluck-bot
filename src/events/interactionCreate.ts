import { Events, Interaction } from 'discord.js';
import { createCommandLogger } from '../utils/logger';
import { handlePotluckModal, handleAddCustomModal, handlePotluckButtonInteraction, handlePotluckFromEventModal } from '../commands/potluck';

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'potluck-create') {
        await handlePotluckModal(interaction);
        return;
      }
      if (interaction.customId.startsWith('add-custom-')) {
        await handleAddCustomModal(interaction);
        return;
      }
      if (interaction.customId.startsWith('potluck-from-event-')) {
        await handlePotluckFromEventModal(interaction);
        return;
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('claim-') || interaction.customId === 'add-custom-item') {
        const logger = createCommandLogger(interaction);
        try {
          await handlePotluckButtonInteraction(interaction);
          logger.info({
            event: 'button_interaction_executed',
            buttonId: interaction.customId,
            userTag: interaction.user.tag,
            executionSuccess: true
          }, `User clicked button ${interaction.customId}`);
        } catch (error) {
          logger.error({
            err: error,
            event: 'button_interaction_error',
            buttonId: interaction.customId,
            userTag: interaction.user.tag
          }, `Error handling button interaction ${interaction.customId}`);
          
          const errorMessage = 'There was an error processing your request. Please try again.';
          
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
          } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
          }
        }
        return;
      }
    }

    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        if ('autocomplete' in command && command.autocomplete) {
          await command.autocomplete(interaction);
        }
      } catch (error) {
        console.error('Error handling autocomplete:', error);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    const logger = createCommandLogger(interaction);

    if (!command) {
      logger.error({
        event: 'command_not_found',
        commandName: interaction.commandName,
        availableCommands: Array.from(interaction.client.commands.keys())
      }, `No command matching ${interaction.commandName} was found`);
      return;
    }

    try {
      await command.execute(interaction);
      logger.info({
        event: 'slash_command_executed',
        commandName: interaction.commandName,
        userTag: interaction.user.tag,
        executionSuccess: true
      }, `User executed /${interaction.commandName}`);
    } catch (error) {
      logger.error({
        err: error,
        event: 'slash_command_error',
        commandName: interaction.commandName,
        userTag: interaction.user.tag
      }, `Error executing ${interaction.commandName}`);
      
      const errorMessage = 'There was an error while executing this command!';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },
};