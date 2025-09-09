import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help on how to use the Potluck Bot'),
  
  async execute(interaction: CommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle('🍽️ Potluck Bot Help')
      .setColor(0x00AE86)
      .setDescription('Welcome to Potluck Bot! This bot helps you organize potluck events where people can sign up to bring different items.')
      .addFields(
        {
          name: '🎉 Creating a Potluck',
          value: 'Use `/potluck` to create a new potluck event. You can:\n' +
                 '• Create a standalone potluck with name, date, theme, and items\n' +
                 '• Create a potluck from an existing Discord scheduled event\n' +
                 '• Automatically create a Discord event when providing a date',
          inline: false
        },
        {
          name: '📝 Managing Items',
          value: 'Once a potluck is created:\n' +
                 '• Click item buttons to claim/unclaim items\n' +
                 '• Use "Add Custom Item" to add items not in the original list\n' +
                 '• Multiple people can claim the same item if needed',
          inline: false
        },
        {
          name: '🎯 Discord Event Integration',
          value: 'Potluck Bot integrates with Discord events:\n' +
                 '• Sync RSVPs between Discord events and potluck attendance\n' +
                 '• Update event descriptions with potluck details\n' +
                 '• Create events automatically from date input',
          inline: false
        },
        {
          name: '🔧 Available Commands',
          value: '• `/potluck` - Create and manage potluck events\n' +
                 '• `/ping` - Check bot responsiveness\n' +
                 '• `/help` - Show this help message',
          inline: false
        },
        {
          name: '💡 Tips',
          value: '• Potluck messages update automatically when items are claimed\n' +
                 '• Bot needs "Manage Events" permission for Discord event features\n' +
                 '• Items can be claimed by multiple people for larger gatherings',
          inline: false
        }
      )
      .setFooter({ text: 'Happy potlucking! 🥗' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};