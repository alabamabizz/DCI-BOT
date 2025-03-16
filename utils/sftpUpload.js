const Client = require('ssh2-sftp-client');
require('dotenv').config();

async function uploadFile(localPath, remotePath) {
    const sftp = new Client();
    
    try {
        await sftp.connect({
            host: process.env.SFTP_HOST,
            port: process.env.SFTP_PORT || 22,
            username: process.env.SFTP_USER,
            password: process.env.SFTP_PASS
        });

        await sftp.put(localPath, remotePath);
        console.log(`Uploaded: ${localPath} -> ${remotePath}`);
    } catch (err) {
        console.error(`SFTP Upload Error: ${err.message}`);
    } finally {
        await sftp.end();
    }
}

module.exports = { uploadFile };
