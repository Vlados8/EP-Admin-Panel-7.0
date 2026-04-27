const mysqldump = require('mysqldump');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

exports.downloadDatabaseBackup = async (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `empire-crm-backup-${timestamp}.sql`;
        const tempFilePath = path.join(os.tmpdir(), `${crypto.randomUUID()}-${filename}`);

        const dbHost = process.env.DB_HOST || process.env.MYSQLHOST;
        const dbPort = process.env.DB_PORT || process.env.MYSQLPORT || 3306;
        const dbUser = process.env.DB_USER || process.env.MYSQLUSER;
        const dbPassword = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD;
        const dbName = process.env.DB_NAME || process.env.MYSQLDATABASE;

        if (!dbHost || !dbUser || !dbName) {
            return res.status(500).json({
                status: 'error',
                message: 'Database connection configuration is missing.'
            });
        }

        await mysqldump({
            connection: {
                host: dbHost,
                port: parseInt(dbPort, 10),
                user: dbUser,
                password: dbPassword,
                database: dbName,
            },
            dumpToFile: tempFilePath,
        });

        res.download(tempFilePath, filename, (err) => {
            if (err) {
                console.error('Error sending backup file:', err);
                if (!res.headersSent) {
                    res.status(500).json({ status: 'error', message: 'Failed to download backup file' });
                }
            }
            // Delete temp file after sending
            fs.unlink(tempFilePath, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting temp backup file:', unlinkErr);
            });
        });
    } catch (error) {
        console.error('Database backup error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate database backup',
            error: error.message
        });
    }
};
