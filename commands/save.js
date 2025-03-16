// save.js - Saves transcript manually with role checks
const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
const { saveTranscript } = require('../utils/transcriptUtils');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('save')
        .setDescription('Manually save the transcript of a ticket'),

    async execute(interaction) {
        const channel = interaction.channel;
        const userRoles = interaction.member.roles.cache.map(role => role.id);
        
        // Find ticket in database
        const [ticket] = await db.query(`SELECT request_id FROM investigation_requests WHERE channel_id = ? UNION SELECT request_id FROM intelligence_requests WHERE channel_id = ?`, [channel.id, channel.id]);
        if (!ticket.length) return interaction.reply({ content: 'This channel is not a valid ticket.', ephemeral: false });
        
        const requestId = ticket[0].request_id;
        
        // Extract clearance level
        const match = requestId.match(/^([VI])-(\d{2})-\d{4}$/);
        if (!match) return interaction.reply({ content: 'Invalid request ID format.', ephemeral: false });
        
        const [_, type, clearance] = match;
        const requiredRoles = {
            '01': [process.env.ROLE_LOWER_COMMAND, process.env.ROLE_COMMAND, process.env.ROLE_HIGH_COMMAND],
            '02': [process.env.ROLE_COMMAND, process.env.ROLE_HIGH_COMMAND],
            '03': [process.env.ROLE_HIGH_COMMAND]
        };

        if (!userRoles.some(role => requiredRoles[clearance].includes(role))) {
            return interaction.reply({ content: 'You do not have permission to save this transcript.', ephemeral: true });
        }

        // Save transcript
        await saveTranscript(channel, requestId);
        await interaction.reply({ content: `Transcript for **${requestId}** has been saved.`, ephemeral: false });
    }
};
