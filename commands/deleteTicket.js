const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deleteticket')
    .setDescription('Delete a closed ticket.')
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for deleting the ticket')
        .setRequired(true)),
  async execute(interaction, pool) {
    const channel = interaction.channel;
    const reason = interaction.options.getString('reason');

    try {
      // Fetch the ticket from the database
      const [rows] = await pool.query('SELECT * FROM investigation_requests WHERE channel_id = ?', [channel.id]);

      if (rows.length === 0) {
        return interaction.reply({ content: 'This channel is not associated with a ticket.', ephemeral: true });
      }

      const ticket = rows[0];

      // Check if the ticket is closed
      if (ticket.status !== 'closed') {
        return interaction.reply({ content: 'Only closed tickets can be deleted.', ephemeral: true });
      }

      // Fetch all messages in the channel
      const messages = await channel.messages.fetch({ limit: 100 });

      // Format messages into a transcript (ignore messages after the "Ticket Closed" embed)
      const transcript = messages.reverse().filter(msg => {
        return !msg.embeds.some(embed => embed.description === 'This request has been closed.');
      }).map(msg => {
        return `[${msg.author.username}] ${msg.createdAt.toLocaleString()}: ${msg.content}`;
      }).join('\n');

      // Save the transcript to the /transcripts folder
      const transcriptPath = path.join(__dirname, '..', 'transcripts', `${channel.name}.txt`);
      fs.writeFileSync(transcriptPath, transcript);

      // Delete the channel
      await channel.delete(`Ticket deleted by ${interaction.user.tag}. Reason: ${reason}`);

      // Delete the ticket from the database
      await pool.query('DELETE FROM investigation_requests WHERE channel_id = ?', [channel.id]);

      // Reply to the user
      await interaction.reply({ content: `Ticket deleted and transcript saved: ${channel.name}.txt`, ephemeral: true });
    } catch (error) {
      console.error('Error deleting ticket:', error);
      await interaction.reply({ content: 'There was an error deleting the ticket.', ephemeral: true });
    }
  },
};