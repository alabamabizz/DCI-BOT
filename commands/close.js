// close.js - Closes a ticket and saves transcript
const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db'); // Keep this consistent
const { saveTranscript } = require('../utils/transcriptUtils');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('Close an active investigation or intelligence log ticket'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true }); // Prevent Discord timeout
        
        const channel = interaction.channel;
        const userRoles = interaction.member.roles.cache.map(role => role.id);
        
        // Find ticket in database
        const [ticket] = await db.query(`SELECT request_id FROM investigation_requests WHERE channel_id = ? UNION SELECT request_id FROM intelligence_requests WHERE channel_id = ?`, [channel.id, channel.id]);
        if (!ticket.length) return interaction.editReply({ content: 'This channel is not a valid ticket.' });
        
        const requestId = ticket[0].request_id;
        
        // Extract clearance level
        const match = requestId.match(/^([VI])-(\d{2})-\d{4}$/);
        if (!match) return interaction.editReply({ content: 'Invalid request ID format.' });
        
        console.log('User Roles:', interaction.member.roles.cache.map(r => `${r.name} (${r.id})`));
        console.log('High Command Role ID:', process.env.ROLE_HIGH_COMMAND);

        const [_, type, clearance] = match;
        const requiredRoles = {
            '01': [process.env.ROLE_LOWER_COMMAND, process.env.ROLE_COMMAND, process.env.ROLE_HIGH_COMMAND],
            '02': [process.env.ROLE_COMMAND, process.env.ROLE_HIGH_COMMAND],
            '03': [process.env.ROLE_HIGH_COMMAND]
        };

        if (!userRoles.some(role => requiredRoles[clearance].includes(role))) {
            return interaction.editReply({ content: 'You do not have permission to close this ticket.' });
        }

        // Save transcript
        await saveTranscript(channel, requestId);
        
        // Remove user access and rename channel
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
        await channel.setName(`closed-${requestId}`);
        
        // Fix SQL syntax - Separate UPDATE queries
        await db.query(`UPDATE investigation_requests SET status = 'closed' WHERE request_id = ?`, [requestId]);
        await db.query(`UPDATE intelligence_requests SET status = 'closed' WHERE request_id = ?`, [requestId]);
        
        await interaction.editReply({ content: `Ticket **${requestId}** has been closed. Transcript saved.` });
    }
};
