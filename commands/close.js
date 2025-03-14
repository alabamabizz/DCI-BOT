const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close an investigation or intelligence request.'),
  async execute(interaction, pool) {
    const channel = interaction.channel;

    try {
      // Check if the channel is a ticket (starts with "X-" or "I-")
      if (!channel.name.startsWith('X-') && !channel.name.startsWith('I-')) {
        return interaction.reply({ content: 'This command can only be used in ticket channels.', flags: 'Ephemeral' });
      }

      // Fetch the ticket from the database
      const [rows] = await pool.query('SELECT * FROM investigation_requests WHERE channel_id = ?', [channel.id]);

      if (rows.length === 0) {
        return interaction.reply({ content: 'This channel is not associated with a ticket.', flags: 'Ephemeral' });
      }

      const ticket = rows[0];

      // Check if the ticket is already closed
      if (ticket.status === 'closed') {
        return interaction.reply({ content: 'This ticket is already closed.', flags: 'Ephemeral' });
      }

      // Update the ticket status to "closed" in the database
      await pool.query('UPDATE investigation_requests SET status = ? WHERE channel_id = ?', ['closed', channel.id]);

      // Rename the channel to "closed-XX-YY-ZZZZ" or "closed-I-YY-ZZZZ"
      const newChannelName = channel.name.startsWith('X-')
        ? channel.name.replace('X-', 'closed-X-')
        : channel.name.replace('I-', 'closed-I-');

      await channel.setName(newChannelName);

      // Send an embed message to indicate the ticket is closed
      const embed = new EmbedBuilder()
        .setTitle('Ticket Closed')
        .setDescription('This request has been closed.')
        .setColor('#FF0000'); // Red color for emphasis

      await channel.send({ embeds: [embed] });

      // Reply to the user (visible to everyone)
      await interaction.reply({ content: `Ticket closed: ${newChannelName}` });
    } catch (error) {
      console.error('Error closing ticket:', error);
      await interaction.reply({ content: 'There was an error closing the ticket.', flags: 'Ephemeral' });
    }
  },
};