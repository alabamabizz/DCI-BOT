const fs = require('fs');
const path = require('path');
const { uploadFile } = require('./sftpUpload');
const db = require('../database/db');

async function saveTranscript(channel, requestId) {
    const messages = await channel.messages.fetch({ limit: 100 });
    const transcriptContent = messages.map(m => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}`).reverse().join('\n');

    const transcriptDir = path.join(__dirname, '../transcripts');
    if (!fs.existsSync(transcriptDir)) fs.mkdirSync(transcriptDir, { recursive: true });

    const transcriptPath = path.join(transcriptDir, `${requestId}.html`);
    fs.writeFileSync(transcriptPath, `<pre>${transcriptContent}</pre>`);

    const remotePath = `/home/container/webroot/transcripts/${requestId}.html`;
    await uploadFile(transcriptPath, remotePath);

    await db.query(`INSERT INTO ticket_transcripts (request_id, file_path) VALUES (?, ?) ON DUPLICATE KEY UPDATE file_path = ?`, [requestId, remotePath, remotePath]);
}

module.exports = { saveTranscript };