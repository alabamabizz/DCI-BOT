const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function generateHash() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('save')
    .setDescription('Save the transcript of a ticket.'),
  async execute(interaction, pool) {
    const channel = interaction.channel;

    try {
      const [rows] = await pool.query('SELECT request_id FROM investigation_requests WHERE channel_id = ?', [channel.id]);
      const originalTicketId = rows[0]?.request_id;

      if (!originalTicketId) {
        return interaction.reply({ content: 'This channel is not associated with a ticket.', flags: 'Ephemeral' });
      }

      const messages = await channel.messages.fetch({ limit: 100 });

      const transcriptContent = messages.reverse().map(msg => {
        const nickname = msg.member?.nickname || msg.author.username;
        let content = `<div class="message">
          <span class="username">${nickname}</span>
          <span class="timestamp">${msg.createdAt.toLocaleString()}</span>
          <p class="content">${msg.content}</p>`;

        if (msg.embeds.length > 0) {
          content += `<div class="embed">${msg.embeds[0].description || 'Embed'}</div>`;
        }

        if (msg.attachments.size > 0) {
          content += `<div class="attachment">
            <a href="${msg.attachments.first().url}" target="_blank">Attachment</a>
          </div>`;
        }

        content += '</div>';
        return content;
      }).join('\n');

      const transcriptHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Transcript - ${originalTicketId}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; background-color: #f4f4f4; }
                .message { background-color: #fff; padding: 10px; margin-bottom: 10px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
                .username { font-weight: bold; color: #007BFF; }
                .timestamp { color: #666; font-size: 0.9em; margin-left: 10px; }
                .content { margin-top: 5px; }
                .embed, .attachment { margin-top: 10px; padding: 5px; background-color: #f9f9f9; border-left: 3px solid #007BFF; }
                a { color: #007BFF; text-decoration: none; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <h1>Transcript - ${originalTicketId}</h1>
            <div id="messages">${transcriptContent}</div>
        </body>
        </html>
      `;

      const transcriptHash = generateHash();
      const transcriptPath = path.join('/var/www/transcripts', `${transcriptHash}.html`);
      fs.writeFileSync(transcriptPath, transcriptHtml);

      await pool.query('INSERT INTO ticket_transcripts (ticket_id, file_path, transcript_hash) VALUES (?, ?, ?)', [originalTicketId, transcriptPath, transcriptHash]);

      const transcriptUrl = `http://${process.env.SITE_DOMAIN}/transcripts/${transcriptHash}.html`;
      await interaction.reply({ content: `Transcript saved: ${transcriptUrl}`, flags: 'Ephemeral' });

      const transcriptChannel = interaction.guild.channels.cache.get(process.env.TRANSCRIPT_CHANNEL_ID);
      if (transcriptChannel) {
        await transcriptChannel.send({ content: `Transcript for ${originalTicketId}: ${transcriptUrl}` });
      }
    } catch (error) {
      console.error('Error saving transcript:', error);
      await interaction.reply({ content: 'There was an error saving the transcript.', flags: 'Ephemeral' });
    }
  },
};