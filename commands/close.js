const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Helper function to check if a channel is a ticket
function isTicketChannel(channelName) {
  const prefixes = ['x-', 'i-', 'closed-x-', 'closed-i-'];
  return prefixes.some(prefix => channelName.toLowerCase().startsWith(prefix));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close an investigation or intelligence request.'),
  async execute(interaction, pool) {
    const channel = interaction.channel;

    try {
      // Check if the channel is a ticket (including closed tickets)
      if (!isTicketChannel(channel.name)) {
        return interaction.reply({ content: 'This command can only be used in ticket channels.', flags: 'Ephemeral' });
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
      const transcriptHeader = `INVESTIGATION ${channel.name.toUpperCase()}\n\n`;
      const fullTranscript = transcriptHeader + transcript;

      // Save the transcript to the /transcripts folder
      const transcriptPath = path.join(__dirname, '..', 'transcripts', `${channel.name}.txt`);
      fs.writeFileSync(transcriptPath, fullTranscript);

      // Log the transcript in the database
      await pool.query('INSERT INTO ticket_transcripts (ticket_id, file_path) VALUES (?, ?)', [channel.name, transcriptPath]);

      // Auto-send the transcript to the transcript channel
      const transcriptChannel = interaction.guild.channels.cache.get(process.env.TRANSCRIPT_CHANNEL_ID);
      if (transcriptChannel) {
        await transcriptChannel.send({
          content: `Transcript for ${channel.name}:`,
          files: [transcriptPath],
        });
      }

      // Rename the channel to "closed-X-YY-ZZZZ" or "closed-I-YY-ZZZZ"
      const newChannelName = channel.name.toLowerCase().startsWith('closed-')
        ? channel.name // Already closed, no need to rename
        : channel.name.startsWith('x-')
          ? channel.name.replace('x-', 'closed-x-')
          : channel.name.replace('i-', 'closed-i-');

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