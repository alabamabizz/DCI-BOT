// delete.js - Deletes a closed ticket with permission checks
const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deleteticket')
        .setDescription('Delete a closed ticket.')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for deleting the ticket')
                .setRequired(true)),

    async execute(interaction) {
        const channel = interaction.channel;
        const userRoles = interaction.member.roles.cache.map(role => role.id);
        const reason = interaction.options.getString('reason');

        // Find ticket in database
        const [ticket] = await db.query(`SELECT request_id, status FROM investigation_requests WHERE channel_id = ? UNION SELECT request_id, status FROM intelligence_requests WHERE channel_id = ?`, [channel.id, channel.id]);
        if (!ticket.length) return interaction.reply({ content: 'This channel is not a valid ticket.', ephemeral: false });
        
        const requestId = ticket[0].request_id;
        if (ticket[0].status !== 'closed') return interaction.reply({ content: 'Only closed tickets can be deleted.', ephemeral: false });
        
        // Extract clearance level
        const match = requestId.match(/^([VI])-(\d{2})-\d{4}$/);
        if (!match) return interaction.reply({ content: 'Invalid ticket ID format.', ephemeral: false });
        
        const [_, type, clearance] = match;
        const requiredRoles = {
            '01': [process.env.ROLE_LOWER_COMMAND, process.env.ROLE_COMMAND, process.env.ROLE_HIGH_COMMAND],
            '02': [process.env.ROLE_COMMAND, process.env.ROLE_HIGH_COMMAND],
            '03': [process.env.ROLE_HIGH_COMMAND]
        };

        if (!userRoles.some(role => requiredRoles[clearance].includes(role))) {
            return interaction.reply({ content: 'You do not have permission to delete this ticket.', ephemeral: true });
        }

        await channel.delete(`Ticket deleted by ${interaction.user.tag}. Reason: ${reason}`);
        await db.query(`DELETE FROM investigation_requests WHERE request_id = ? UNION DELETE FROM intelligence_requests WHERE request_id = ?`, [requestId, requestId]);

        interaction.reply({ content: `Ticket **${requestId}** deleted successfully.`, ephemeral: false });
    }
};