const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close an investigation request.'),
  async execute(interaction, pool) {
    const channel = interaction.channel;

    try {
      // Check if the channel is a ticket (e.g., starts with "X-")
      if (!channel.name.startsWith('X-')) {
        return interaction.reply({ content: 'This command can only be used in ticket channels.', ephemeral: true });
      }

      // Fetch the ticket from the database
      const [rows] = await pool.query('SELECT * FROM investigation_requests WHERE channel_id = ?', [channel.id]);

      if (rows.length === 0) {
        return interaction.reply({ content: 'This channel is not associated with a ticket.', ephemeral: true });
      }

      const ticket = rows[0];

      // Check if the ticket is already closed
      if (ticket.status === 'closed') {
        return interaction.reply({ content: 'This ticket is already closed.', ephemeral: true });
      }

      // Update the ticket status to "closed" in the database
      await pool.query('UPDATE investigation_requests SET status = ? WHERE channel_id = ?', ['closed', channel.id]);

      // Rename the channel to "closed-XX-YY-ZZZZ"
      const newChannelName = channel.name.replace('X-', 'closed-');
      await channel.setName(newChannelName);

      // Send an embed message to indicate the ticket is closed
      const embed = new EmbedBuilder()
        .setTitle('Ticket Closed')
        .setDescription('This request has been closed.')
        .setColor('#FF0000'); // Red color for emphasis

      await channel.send({ embeds: [embed] });

      // Reply to the user
      await interaction.reply({ content: `Ticket closed: ${newChannelName}`, ephemeral: true });
    } catch (error) {
      console.error('Error closing ticket:', error);
      await interaction.reply({ content: 'There was an error closing the ticket.', ephemeral: true });
    }
  },
};