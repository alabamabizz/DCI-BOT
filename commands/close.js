const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Helper function to fetch the original ticket ID
async function getOriginalTicketId(pool, channelId) {
  const [investigationRows] = await pool.query('SELECT request_id FROM investigation_requests WHERE channel_id = ?', [channelId]);
  if (investigationRows.length > 0) return investigationRows[0].request_id;

  const [intelligenceRows] = await pool.query('SELECT request_id FROM intelligence_requests WHERE channel_id = ?', [channelId]);
  if (intelligenceRows.length > 0) return intelligenceRows[0].request_id;

  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close an investigation or intelligence request.'),
  async execute(interaction, pool) {
    const channel = interaction.channel;

    try {
      // Fetch the original ticket ID from the database
      const originalTicketId = await getOriginalTicketId(pool, channel.id);

      if (!originalTicketId) {
        return interaction.reply({ content: 'This channel is not associated with a ticket.', flags: 'Ephemeral' });
      }

      // Fetch all messages in the channel
      const messages = await channel.messages.fetch({ limit: 100 });

      // Format messages into a transcript
      const transcript = messages.reverse().map(msg => {
        let content = `(${msg.author.username}) (${msg.author.id})\n- ${msg.content}`;

        // Add links to embeds or files
        if (msg.embeds.length > 0) {
          content += `\n- Embed: ${msg.embeds[0].url}`;
        }
        if (msg.attachments.size > 0) {
          content += `\n- File: ${msg.attachments.first().url}`;
        }

        return content;
      }).join('\n\n');

      // Create the transcript header
      const transcriptHeader = `INVESTIGATION ${originalTicketId.toUpperCase()}\n\n`;
      const fullTranscript = transcriptHeader + transcript;

      // Save the transcript to the /transcripts folder
      const transcriptPath = path.join(__dirname, '..', 'transcripts', `${originalTicketId}.txt`);
      fs.writeFileSync(transcriptPath, fullTranscript);

      // Log the transcript in the database
      await pool.query('INSERT INTO ticket_transcripts (ticket_id, file_path) VALUES (?, ?)', [originalTicketId, transcriptPath]);

      // Auto-send the transcript to the transcript channel
      const transcriptChannel = interaction.guild.channels.cache.get(process.env.TRANSCRIPT_CHANNEL_ID);
      if (transcriptChannel) {
        await transcriptChannel.send({
          content: `Transcript for ${originalTicketId}:`,
          files: [transcriptPath],
        });
      }

      // Rename the channel to "closed-X-YY-ZZZZ" or "closed-I-YY-ZZZZ"
      const newChannelName = originalTicketId.startsWith('X-')
        ? `closed-${originalTicketId}`
        : `closed-${originalTicketId}`;

      await channel.setName(newChannelName);

      // Send an embed message to indicate the ticket is closed
      const embed = new EmbedBuilder()
        .setTitle('Ticket Closed')
        .setDescription('This request has been closed.')
        .setColor('#FF0000'); // Red color for emphasis

      await channel.send({ embeds: [embed] });

      // Reply to the user
      await interaction.reply({ content: `Ticket closed: ${newChannelName}`, flags: 'Ephemeral' });

      // Log the command
      await logCommand(interaction, 'close');
    } catch (error) {
      console.error('Error closing ticket:', error);
      await interaction.reply({ content: 'There was an error closing the ticket.', flags: 'Ephemeral' });
    }
  },
};