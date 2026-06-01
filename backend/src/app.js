require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const path = require('path');
require('./config/redis'); // Initialize Redis connection

// Express App Intialization
const app = express();

// Enable trust proxy for correct IP detection on hosting (e.g., Railway)
app.set('trust proxy', 1);

// Middlewares
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "blob:", "http://localhost:3001", "http://localhost:3000", "https://ui-avatars.com", "https://*.empire-premium.de", "https://*.empire-premium-bau.de", "https://*.railway.app", "https://*.r2.dev", "https://*.cloudflarestorage.com", "https://*.jsdelivr.net"],
            "media-src": ["'self'", "data:", "blob:", "http://localhost:3001", "http://localhost:3000", "https://*.empire-premium.de", "https://*.empire-premium-bau.de", "https://*.railway.app", "https://*.r2.dev", "https://*.cloudflarestorage.com"],
            "script-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            "style-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            "connect-src": ["'self'", "ws:", "wss:", "http:", "https:"],
            "frame-src": ["'self'", "https://maps.google.com", "https://www.google.com", "https://maps.google.de", "https://www.google.de"],
            "child-src": ["'self'", "https://maps.google.com", "https://www.google.com", "https://maps.google.de", "https://www.google.de"]
        }
    }
}));
app.use(cors({ origin: '*' }));

// Healthcheck Route (Top priority for Railway)
app.get('/api/v1/health', async (req, res) => {
    const sequelize = require('./config/database');
    const { ProjectFolder, ProjectFile, User } = require('./domain/models');
    const fs = require('fs');
    const path = require('path');

    let dbStatus = 'connected';
    try {
        await sequelize.authenticate();
    } catch (err) {
        dbStatus = 'connecting/error';
    }

    const infrastructurePath = path.join(__dirname, 'infrastructure');
    let dirSnapshot = {};
    try {
        if (fs.existsSync(infrastructurePath)) {
            const subdirs = fs.readdirSync(infrastructurePath);
            subdirs.forEach(sd => {
                const fullSdPath = path.join(infrastructurePath, sd);
                if (fs.statSync(fullSdPath).isDirectory()) {
                    dirSnapshot[sd] = fs.readdirSync(fullSdPath);
                }
            });
        } else {
            dirSnapshot = 'INFRASTRUCTURE_MISSING';
        }
    } catch (err) {
        dirSnapshot = 'DIR_ERROR: ' + err.message;
    }

    res.status(200).json({
        status: 'success',
        database: dbStatus,
        filesystem: dirSnapshot,
        timestamp: new Date().toISOString()
    });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the project root 'uploads' directory with cross-origin permission
app.use('/uploads', (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(path.join(__dirname, '../../uploads')));

// Request Logging Middleware
app.use((req, res, next) => {
    if (req.url.includes('company')) {
        console.log(`[DEBUG] ${req.method} ${req.url} HEADERS:`, JSON.stringify(req.headers, null, 2));
    }
    logger.info(`${req.method} ${req.url}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    next();
});

// Global Rate Limit (Disabled in dev to avoid 429 errors while testing)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000,               // Limit each IP to 10k requests for dev
});
app.use(limiter);

// Healthcheck is now at the top

// Import Routes
console.log('--- ROUTE RESOLUTION CHECK ---');
console.log('__dirname:', __dirname);
const apiKeyRoutesPath = path.join(__dirname, 'infrastructure/routes/api-key.routes.js');
console.log('Target Path:', apiKeyRoutesPath);

// Mount Routes (Wrapped in try/catch for Railway debugging)
try {
    const authRoutes = require('./infrastructure/routes/authRoutes');
    const companyRoutes = require('./infrastructure/routes/companyRoutes');
    const userRoutes = require('./infrastructure/routes/userRoutes');
    const roleRoutes = require('./infrastructure/routes/roleRoutes');
    const noteRoutes = require('./infrastructure/routes/noteRoutes');
    const taskRoutes = require('./infrastructure/routes/taskRoutes');
    const subcontractorRoutes = require('./infrastructure/routes/subcontractorRoutes');
    const clientRoutes = require('./infrastructure/routes/clientRoutes');
    const categoryRoutes = require('./infrastructure/routes/categoryRoutes');
    const inquiryRoutes = require('./infrastructure/routes/inquiryRoutes');
    const projectRoutes = require('./infrastructure/routes/projectRoutes');
    const offerRoutes = require('./infrastructure/routes/offerRoutes');
    const supportRoutes = require('./infrastructure/routes/supportRoutes');
    const emailRoutes = require('./infrastructure/routes/emailRoutes');
    const publicRoutes = require('./infrastructure/routes/publicRoutes');
    const dashboardRoutes = require('./infrastructure/routes/dashboardRoutes');
    const chatRoutes = require('./infrastructure/routes/chatRoutes');
    const phoneRoutes = require('./infrastructure/routes/phoneRoutes');
    const fileRoutes = require('./infrastructure/routes/fileRoutes');
    const timeTrackingRoutes = require('./infrastructure/routes/timeTrackingRoutes');
    const reonicRoutes = require('./infrastructure/routes/reonicRoutes');
    const systemRoutes = require('./infrastructure/routes/systemRoutes');
    const notificationRoutes = require('./infrastructure/routes/notificationRoutes');

    // --- PUBLIC WEBHOOKS ---
    // CRM Integrations (e.g. MyGo) - Uses simple multer for attachments
    const upload = require('multer')();
    app.post('/api/v1/integrations/mygo', upload.any(), require('./infrastructure/controllers/IntegrationController').handleMyGoWebhook);

    // Public Shared Folder Routes (NO AUTH)
    app.use('/api/v1/public', publicRoutes);
    // -----------------------

    // Railway Healthcheck
    app.get('/api/v1/health', (req, res) => {
        res.status(200).json({ status: 'ok', timestamp: new Date() });
    });

    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/company', companyRoutes);
    app.use('/api/v1/users', userRoutes);
    app.use('/api/v1/roles', roleRoutes);
    app.use('/api/v1/notes', noteRoutes);
    app.use('/api/v1/tasks', taskRoutes);
    app.use('/api/v1/attachments', require('./infrastructure/routes/attachmentRoutes'));
    app.use('/api/v1/subcontractors', subcontractorRoutes);
    app.use('/api/v1/clients', clientRoutes);
    app.use('/api/v1/categories', categoryRoutes);
    app.use('/api/v1/inquiries', inquiryRoutes);
    app.use('/api/v1/projects', projectRoutes);
    app.use('/api/v1/offers', offerRoutes);
    app.use('/api/v1/project-stages', require('./infrastructure/routes/projectStageRoutes'));
    app.use('/api/v1/support', supportRoutes);
    app.use('/api/v1/emails', emailRoutes);
    app.use('/api/v1/dashboard', dashboardRoutes);
    app.use('/api/v1/chat', chatRoutes);
    app.use('/api/v1/phone', phoneRoutes);
    app.use('/api/v1/files', fileRoutes);
    app.use('/api/v1/time-tracking', timeTrackingRoutes);
    app.use('/api/v1/reonic', reonicRoutes);
    app.use('/api/v1/system', systemRoutes);
    app.use('/api/v1/notifications', notificationRoutes);

    // The problematic route
    const apiKeyRoutes = require(apiKeyRoutesPath);
    app.use('/api/v1/api-keys', apiKeyRoutes);

} catch (err) {
    console.error('CRITICAL: Route initialization failed:', err.message);
    app.use('/api/v1', (req, res) => {
        res.status(500).json({
            status: 'error',
            message: 'API is partially unavailable due to module resolution issues.',
            error: err.message
        });
    });
}

// --- Serve Frontend in Production ---
if (process.env.NODE_ENV === 'production') {
    const frontendDist = path.join(__dirname, '../../frontend/dist');
    app.use(express.static(frontendDist));

    app.get(/.*/, (req, res) => {
        // Fallback for SPA routing - Ignore API requests
        if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
            return res.status(404).json({ status: 'fail', message: 'Not found' });
        }
        res.sendFile(path.join(frontendDist, 'index.html'));
    });
}
// ------------------------------------

// Centralized Error Handling Placeholder
app.use((err, req, res, next) => {
    logger.error(`${err.statusCode || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    logger.error(err.stack);

    res.status(err.statusCode || 500).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
        error: err,
        stack: err.stack
    });
});

const PORT = process.env.PORT || 3000;
const http = require('http');
const { initWebSocket } = require('./infrastructure/websocket');

console.log('--- BACKEND BOOTSTRAP STARTING ---');

if (require.main === module) {
    (async () => {
        const server = http.createServer(app);

        // Initialize WebSockets
        initWebSocket(server);

        // Import all models
        const { ProjectFolder, ProjectFile, User, Conversation, Participant, Message } = require('./domain/models');

        const PORT = process.env.PORT || 3001;

        // Start listening IMMEDIATELY (Node defaults to `::` and `0.0.0.0` which supports both IPv6 and IPv4)
        server.listen(PORT, async () => {
            console.log(`Server is now listening on port ${PORT}`);
            logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);

            // Start the periodic task & note reminder scanner daemon in the background
            try {
                const startReminderDaemon = require('./utils/reminderDaemon');
                startReminderDaemon();
            } catch (daemonErr) {
                console.error('[ReminderDaemon] Failed to start daemon:', daemonErr.message);
            }

            // Perform DB sync/seed in background/after listen
            const sequelize = require('./config/database');
            const seedDatabase = require('./infrastructure/database/seeder');
            try {
                console.log('Connecting to database and synchronizing...');
                await sequelize.sync({ alter: { drop: false } });
                console.log('Database synchronized successfully.');

                // MANUALLY FIX missing columns to resolve "Unknown column 'user_id'"
                try {
                    console.log('Verifying companies schema...');
                    const [companySettingsCol] = await sequelize.query("SHOW COLUMNS FROM companies LIKE 'settings'");
                    if (companySettingsCol.length === 0) {
                        console.log('Adding missing settings column to companies...');
                        await sequelize.query("ALTER TABLE companies ADD COLUMN settings JSON NULL");
                    }

                    console.log('Verifying project_folders schema...');
                    const [projectFolderResults] = await sequelize.query("SHOW TABLES LIKE 'project_folders'");

                    console.log('Verifying email_accounts schema...');
                    const [results] = await sequelize.query("SHOW COLUMNS FROM email_accounts LIKE 'user_id'");
                    if (results.length === 0) {
                        console.log('Adding missing user_id column to email_accounts...');
                        await sequelize.query("ALTER TABLE email_accounts ADD COLUMN user_id CHAR(36) NULL COMMENT 'Assigned user, null if shared'");
                    }

                    const [sharedResults] = await sequelize.query("SHOW COLUMNS FROM email_accounts LIKE 'is_shared'");
                    if (sharedResults.length === 0) {
                        console.log('Adding missing is_shared column to email_accounts...');
                        await sequelize.query("ALTER TABLE email_accounts ADD COLUMN is_shared BOOLEAN DEFAULT 1 COMMENT 'If true, everyone in the company can access it'");
                    }

                    const [displayNameResults] = await sequelize.query("SHOW COLUMNS FROM email_accounts LIKE 'display_name'");
                    if (displayNameResults.length === 0) {
                        console.log('Adding missing display_name column to email_accounts...');
                        await sequelize.query("ALTER TABLE email_accounts ADD COLUMN display_name VARCHAR(255) NULL AFTER is_shared");
                    }

                    const [readResults] = await sequelize.query("SHOW COLUMNS FROM emails LIKE 'is_read'");
                    if (readResults.length === 0) {
                        console.log('Adding missing is_read column to emails...');
                        await sequelize.query("ALTER TABLE emails ADD COLUMN is_read BOOLEAN DEFAULT 0 AFTER company_id");
                    }

                    const [directionResults] = await sequelize.query("SHOW COLUMNS FROM emails LIKE 'direction'");
                    if (directionResults.length === 0) {
                        console.log('Adding missing direction column to emails...');
                        await sequelize.query("ALTER TABLE emails ADD COLUMN direction ENUM('inbound', 'outbound') DEFAULT 'inbound' AFTER body_plain");
                    }

                    const [senderEmailResults] = await sequelize.query("SHOW COLUMNS FROM emails LIKE 'sender_email'");
                    if (senderEmailResults.length === 0) {
                        console.log('Adding missing sender_email column to emails...');
                        await sequelize.query("ALTER TABLE emails ADD COLUMN sender_email VARCHAR(255) NULL AFTER sender");
                    }

                    const [recipientEmailResults] = await sequelize.query("SHOW COLUMNS FROM emails LIKE 'recipient_email'");
                    if (recipientEmailResults.length === 0) {
                        console.log('Adding missing recipient_email column to emails...');
                        await sequelize.query("ALTER TABLE emails ADD COLUMN recipient_email VARCHAR(255) NULL AFTER recipient");
                    }

                    const [senderNameResults] = await sequelize.query("SHOW COLUMNS FROM emails LIKE 'sender_name'");
                    if (senderNameResults.length === 0) {
                        console.log('Adding missing sender_name column to emails...');
                        await sequelize.query("ALTER TABLE emails ADD COLUMN sender_name VARCHAR(255) NULL AFTER sender");
                    }

                    const [recipientNameResults] = await sequelize.query("SHOW COLUMNS FROM emails LIKE 'recipient_name'");
                    if (recipientNameResults.length === 0) {
                        console.log('Adding missing recipient_name column to emails...');
                        await sequelize.query("ALTER TABLE emails ADD COLUMN recipient_name VARCHAR(255) NULL AFTER recipient");
                    }

                    const [clientIdResults] = await sequelize.query("SHOW COLUMNS FROM emails LIKE 'client_id'");
                    if (clientIdResults.length === 0) {
                        console.log('Adding missing client_id column to emails...');
                        await sequelize.query("ALTER TABLE emails ADD COLUMN client_id INT NULL AFTER recipient_email, ADD CONSTRAINT fk_emails_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL");
                    }

                    const [inquiryIdResults] = await sequelize.query("SHOW COLUMNS FROM attachments LIKE 'inquiry_id'");
                    if (inquiryIdResults.length === 0) {
                        console.log('Adding missing inquiry_id column to attachments...');
                        await sequelize.query("ALTER TABLE attachments ADD COLUMN inquiry_id INT NULL COMMENT 'Linked inquiry'");
                    }

                    const [emailIdResults] = await sequelize.query("SHOW COLUMNS FROM attachments LIKE 'email_id'");
                    if (emailIdResults.length === 0) {
                        console.log('Adding missing email_id column to attachments...');
                        await sequelize.query("ALTER TABLE attachments ADD COLUMN email_id CHAR(36) NULL AFTER inquiry_id");
                    } else if (emailIdResults[0].Null === 'NO') {
                        console.log('Making email_id nullable in attachments...');
                        await sequelize.query("ALTER TABLE attachments MODIFY COLUMN email_id CHAR(36) NULL");
                    }

                    console.log('Verifying inquiries schema...');
                    const [inquiryReadResults] = await sequelize.query("SHOW COLUMNS FROM inquiries LIKE 'is_read'");
                    if (inquiryReadResults.length === 0) {
                        console.log('Adding missing is_read column to inquiries...');
                        await sequelize.query("ALTER TABLE inquiries ADD COLUMN is_read BOOLEAN DEFAULT 0 AFTER notes");
                    }

                    console.log('Verifying support_tickets schema...');
                    const [supportReadResults] = await sequelize.query("SHOW COLUMNS FROM support_tickets LIKE 'is_read'");
                    if (supportReadResults.length === 0) {
                        console.log('Adding missing is_read column to support_tickets...');
                        await sequelize.query("ALTER TABLE support_tickets ADD COLUMN is_read BOOLEAN DEFAULT 0 AFTER source_website");
                    }

                    console.log('Verifying api_keys schema...');
                    const [apiKeyCategoryResults] = await sequelize.query("SHOW COLUMNS FROM api_keys LIKE 'allowed_category_ids'");
                    if (apiKeyCategoryResults.length === 0) {
                        console.log('Adding missing allowed_category_ids column to api_keys...');
                        await sequelize.query("ALTER TABLE api_keys ADD COLUMN allowed_category_ids JSON NULL");
                    }

                    console.log('Verifying attachments schema for Notes and Tasks...');
                    const [noteIdResults] = await sequelize.query("SHOW COLUMNS FROM attachments LIKE 'note_id'");
                    if (noteIdResults.length === 0) {
                        console.log('Adding missing note_id column to attachments...');
                        await sequelize.query("ALTER TABLE attachments ADD COLUMN note_id INT NULL AFTER inquiry_id");
                    }

                    const [taskIdResults] = await sequelize.query("SHOW COLUMNS FROM attachments LIKE 'task_id'");
                    if (taskIdResults.length === 0) {
                        console.log('Adding missing task_id column to attachments...');
                        await sequelize.query("ALTER TABLE attachments ADD COLUMN task_id INT NULL AFTER note_id");
                    }

                    const [thumbUrlResults] = await sequelize.query("SHOW COLUMNS FROM attachments LIKE 'thumb_url'");
                    if (thumbUrlResults.length === 0) {
                        console.log('Adding missing thumb_url column to attachments...');
                        await sequelize.query("ALTER TABLE attachments ADD COLUMN thumb_url VARCHAR(255) NULL AFTER file_url");
                    }

                    const [originalUrlResults] = await sequelize.query("SHOW COLUMNS FROM attachments LIKE 'original_url'");
                    if (originalUrlResults.length === 0) {
                        console.log('Adding missing original_url column to attachments...');
                        await sequelize.query("ALTER TABLE attachments ADD COLUMN original_url VARCHAR(255) NULL AFTER thumb_url");
                    }

                    if (projectFolderResults.length === 0) {
                        console.log('Creating project_folders table...');
                        await ProjectFolder.sync({ alter: true });
                    } else {
                        // Table exists, verify columns for permissions/sharing
                        console.log('Verifying project_folders columns...');
                        const [roleCols] = await sequelize.query("SHOW COLUMNS FROM project_folders LIKE 'allowed_role_ids'");
                        if (roleCols.length === 0) {
                            console.log('Adding allowed_role_ids to project_folders...');
                            await sequelize.query("ALTER TABLE project_folders ADD COLUMN allowed_role_ids JSON NULL");
                        }
                        const [publicCols] = await sequelize.query("SHOW COLUMNS FROM project_folders LIKE 'is_public'");
                        if (publicCols.length === 0) {
                            console.log('Adding is_public to project_folders...');
                            await sequelize.query("ALTER TABLE project_folders ADD COLUMN is_public BOOLEAN DEFAULT 0");
                        }
                        const [tokenCols] = await sequelize.query("SHOW COLUMNS FROM project_folders LIKE 'share_token'");
                        if (tokenCols.length === 0) {
                            console.log('Adding share_token to project_folders...');
                            await sequelize.query("ALTER TABLE project_folders ADD COLUMN share_token CHAR(36) UNIQUE NULL");
                        }
                        const [createdCols] = await sequelize.query("SHOW COLUMNS FROM project_folders LIKE 'created_by_id'");
                        if (createdCols.length === 0) {
                            console.log('Adding created_by_id to project_folders...');
                            await sequelize.query("ALTER TABLE project_folders ADD COLUMN created_by_id CHAR(36) NULL");
                        }

                        // Backfill share_tokens for existing folders that might have NULL
                        console.log('Backfilling missing share_tokens...');
                        const [folders] = await sequelize.query("SELECT id FROM project_folders WHERE share_token IS NULL");
                        for (const folder of folders) {
                            const newToken = require('crypto').randomUUID();
                            await sequelize.query(`UPDATE project_folders SET share_token = '${newToken}' WHERE id = '${folder.id}'`);
                        }
                    }

                    console.log('Verifying project_files schema...');
                    const [projectFileResults] = await sequelize.query("SHOW TABLES LIKE 'project_files'");
                    if (projectFileResults.length === 0) {
                        console.log('Creating project_files table...');
                        await ProjectFile.sync({ alter: true });
                    }

                    console.log('Verifying chat schema...');
                    const [conversationResults] = await sequelize.query("SHOW TABLES LIKE 'conversations'");
                    if (conversationResults.length === 0) {
                        console.log('Creating chat tables...');
                        await Conversation.sync({ alter: true });
                        await Participant.sync({ alter: true });
                        await Message.sync({ alter: true });
                    } else {
                        const [messageCaptionResults] = await sequelize.query("SHOW COLUMNS FROM messages LIKE 'caption'");
                        if (messageCaptionResults.length === 0) {
                            console.log('Adding missing caption column to messages...');
                            await sequelize.query("ALTER TABLE messages ADD COLUMN caption TEXT NULL AFTER type");
                        }

                        const [messageReplyResults] = await sequelize.query("SHOW COLUMNS FROM messages LIKE 'reply_to_id'");
                        if (messageReplyResults.length === 0) {
                            console.log('Adding missing reply_to_id column to messages...');
                            await sequelize.query("ALTER TABLE messages ADD COLUMN reply_to_id CHAR(36) NULL AFTER caption");
                        }

                        const [messageReactionResults] = await sequelize.query("SHOW COLUMNS FROM messages LIKE 'reactions'");
                        if (messageReactionResults.length === 0) {
                            console.log('Adding missing reactions column to messages...');
                            await sequelize.query("ALTER TABLE messages ADD COLUMN reactions JSON NULL AFTER reply_to_id");
                        } else {
                            // Ensure it's not null and has a default value
                            await sequelize.query("ALTER TABLE messages MODIFY COLUMN reactions JSON NOT NULL");
                        }

                        const [conversationAvatarResults] = await sequelize.query("SHOW COLUMNS FROM conversations LIKE 'avatar'");
                        if (conversationAvatarResults.length === 0) {
                            console.log('Adding missing avatar column to conversations...');
                            await sequelize.query("ALTER TABLE conversations ADD COLUMN avatar VARCHAR(255) NULL AFTER company_id");
                        }

                        const [projectFileUrlResults] = await sequelize.query("SHOW COLUMNS FROM project_files LIKE 'file_url'");
                        if (projectFileUrlResults.length === 0) {
                            console.log('Adding missing file_url column to project_files...');
                            await sequelize.query("ALTER TABLE project_files ADD COLUMN file_url TEXT NULL");
                        }

                        // Ensure message type enum includes video and voice
                        try {
                            console.log('Updating message type ENUM to include video and voice...');
                            await sequelize.query("ALTER TABLE messages MODIFY COLUMN type ENUM('text', 'image', 'video', 'file', 'voice') DEFAULT 'text'");
                        } catch (enumErr) {
                            console.warn('ENUM update failed (likely already updated or different DB engine):', enumErr.message);
                        }
                    }

                    console.log('Verifying users schema for storage...');
                    const [storageLimitCols] = await sequelize.query("SHOW COLUMNS FROM users LIKE 'storage_limit_gb'");
                    if (storageLimitCols.length === 0) {
                        console.log('Adding storage_limit_gb to users...');
                        await sequelize.query("ALTER TABLE users ADD COLUMN storage_limit_gb FLOAT DEFAULT 2.0");
                    }
                    const [storageUsedCols] = await sequelize.query("SHOW COLUMNS FROM users LIKE 'storage_used_bytes'");
                    if (storageUsedCols.length === 0) {
                        console.log('Adding storage_used_bytes to users...');
                        await sequelize.query("ALTER TABLE users ADD COLUMN storage_used_bytes BIGINT DEFAULT 0");
                    }

                    const [lastSeenCols] = await sequelize.query("SHOW COLUMNS FROM users LIKE 'last_seen_at'");
                    if (lastSeenCols.length === 0) {
                        console.log('Adding last_seen_at to users...');
                        await sequelize.query("ALTER TABLE users ADD COLUMN last_seen_at DATETIME NULL");
                    }

                    console.log('Verifying file_folders schema...');
                    const [fileFolderResults] = await sequelize.query("SHOW TABLES LIKE 'file_folders'");
                    if (fileFolderResults.length === 0) {
                        console.log('Creating file_folders table...');
                        const FileFolder = require('./domain/models/FileFolder');
                        await FileFolder.sync({ alter: true });
                    }

                    console.log('Verifying file_favorites schema...');
                    const [fileFavoriteResults] = await sequelize.query("SHOW TABLES LIKE 'file_favorites'");
                    if (fileFavoriteResults.length === 0) {
                        console.log('Creating file_favorites table...');
                        const FileFavorite = require('./domain/models/FileFavorite');
                        await FileFavorite.sync({ alter: true });
                    } else {
                        // More robust migration for folder_id and file_id nullability
                        try {
                            const [cols] = await sequelize.query("PRAGMA table_info(file_favorites)");
                            const hasFolderId = cols.some(c => c.name === 'folder_id');
                            const fileIdCol = cols.find(c => c.name === 'file_id');
                            
                            if (!hasFolderId) {
                                console.log('Adding folder_id to file_favorites...');
                                await sequelize.query("ALTER TABLE file_favorites ADD COLUMN folder_id CHAR(36) NULL");
                            }

                            // If file_id is NOT NULL in SQLite, we might need a workaround. 
                            // But usually PRAGMA table_info will show 'notnull' property.
                            if (fileIdCol && fileIdCol.notnull === 1) {
                                console.log('Attempting to relax file_id in file_favorites (SQLite workaround)...');
                                // Note: SQLite doesn't support MODIFY COLUMN. 
                                // Since this is a small junction table, it's safer to just rely on sync() for complex changes if needed, 
                                // but for now we try to keep it simple.
                            }
                        } catch (err) {
                            // Fallback to MySQL style if PRAGMA fails
                            console.log('Running MySQL fallback for file_favorites...');
                            const [favFolderIdCols] = await sequelize.query("SHOW COLUMNS FROM file_favorites LIKE 'folder_id'");
                            if (favFolderIdCols.length === 0) {
                                await sequelize.query("ALTER TABLE file_favorites ADD COLUMN folder_id CHAR(36) NULL");
                            }
                            
                            // Essential: ensure file_id is NULLABLE in MySQL
                            const [favFileIdCols] = await sequelize.query("SHOW COLUMNS FROM file_favorites LIKE 'file_id'");
                            if (favFileIdCols.length > 0 && favFileIdCols[0].Null === 'NO') {
                                console.log('Making file_id nullable in MySQL file_favorites...');
                                await sequelize.query("ALTER TABLE file_favorites MODIFY COLUMN file_id CHAR(36) NULL");
                            }
                        }
                    }

                    console.log('Verifying file_assets schema...');
                    const [fileAssetResults] = await sequelize.query("SHOW TABLES LIKE 'file_assets'");
                    if (fileAssetResults.length === 0) {
                        console.log('Creating file_assets table...');
                        const FileAsset = require('./domain/models/FileAsset');
                        await FileAsset.sync({ alter: true });
                    } else {
                        const [folderIdCols] = await sequelize.query("SHOW COLUMNS FROM file_assets LIKE 'folder_id'");
                        if (folderIdCols.length === 0) {
                            console.log('Adding folder_id to file_assets...');
                            await sequelize.query("ALTER TABLE file_assets ADD COLUMN folder_id CHAR(36) NULL");
                        }
                        
                        const [assetShareCols] = await sequelize.query("SHOW COLUMNS FROM file_assets LIKE 'share_token'");
                        if (assetShareCols.length === 0) {
                            console.log('Adding sharing columns to file_assets...');
                            await sequelize.query("ALTER TABLE file_assets ADD COLUMN share_token CHAR(36) UNIQUE NULL");
                            await sequelize.query("ALTER TABLE file_assets ADD COLUMN is_external_shared TINYINT(1) DEFAULT 0");
                        }
                    }

                    console.log('Checking sharing columns for file_folders...');
                    const [folderShareCols] = await sequelize.query("SHOW COLUMNS FROM file_folders LIKE 'share_token'");
                    if (folderShareCols.length === 0) {
                        console.log('Adding sharing columns to file_folders...');
                        await sequelize.query("ALTER TABLE file_folders ADD COLUMN share_token CHAR(36) UNIQUE NULL");
                        await sequelize.query("ALTER TABLE file_folders ADD COLUMN is_external_shared TINYINT(1) DEFAULT 0");
                    }

                    console.log('Verifying users schema for SIP/Phone...');
                    const queryInterface = sequelize.getQueryInterface();
                    const userTableInfo = await queryInterface.describeTable('users');
                    
                    if (!userTableInfo.sip_user) {
                        console.log('Adding column sip_user...');
                        await queryInterface.addColumn('users', 'sip_user', { type: require('sequelize').DataTypes.STRING, allowNull: true });
                    }
                    if (!userTableInfo.sip_password) {
                        console.log('Adding column sip_password...');
                        await queryInterface.addColumn('users', 'sip_password', { type: require('sequelize').DataTypes.STRING, allowNull: true });
                    }
                    if (!userTableInfo.sip_domain) {
                        console.log('Adding column sip_domain...');
                        await queryInterface.addColumn('users', 'sip_domain', { type: require('sequelize').DataTypes.STRING, allowNull: true });
                    }
                    if (!userTableInfo.wss_url) {
                        console.log('Adding column wss_url...');
                        await queryInterface.addColumn('users', 'wss_url', { type: require('sequelize').DataTypes.STRING, allowNull: true });
                    }

                    console.log('Verifying call_logs table...');
                    const [callLogTables] = await sequelize.query("SHOW TABLES LIKE 'call_logs'");
                    if (callLogTables.length === 0) {
                        console.log('Creating call_logs table manually...');
                        // This is a fallback, sequelize.sync usually handles this but we want to be sure
                        await sequelize.query(`
                            CREATE TABLE IF NOT EXISTS call_logs (
                                id CHAR(36) BINARY PRIMARY KEY,
                                user_id CHAR(36) BINARY NOT NULL,
                                direction ENUM('inbound', 'outbound') NOT NULL,
                                remote_number VARCHAR(255) NOT NULL,
                                duration_seconds INTEGER DEFAULT 0,
                                status ENUM('completed', 'missed', 'failed', 'busy', 'no-answer') DEFAULT 'completed',
                                created_at DATETIME NOT NULL,
                                updated_at DATETIME NOT NULL
                            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                        `);
                    } else {
                        // Check if call_id exists
                        const [callLogCols] = await sequelize.query("SHOW COLUMNS FROM call_logs LIKE 'call_id'");
                        if (callLogCols.length === 0) {
                            console.log('Adding call_id column to call_logs...');
                            await queryInterface.addColumn('call_logs', 'call_id', { type: require('sequelize').DataTypes.STRING, allowNull: true, unique: true });
                        }
                    }

                    console.log('Verifying users schema for advanced telephony...');
                    const userTableTelephony = await queryInterface.describeTable('users');
                    if (!userTableTelephony.is_receiving_calls) {
                        console.log('Adding column is_receiving_calls...');
                        await queryInterface.addColumn('users', 'is_receiving_calls', { type: require('sequelize').DataTypes.BOOLEAN, defaultValue: false });
                    }
                    if (!userTableTelephony.mobile_phone) {
                        console.log('Adding column mobile_phone...');
                        await queryInterface.addColumn('users', 'mobile_phone', { type: require('sequelize').DataTypes.STRING, allowNull: true });
                    }
                    if (!userTableTelephony.extension_id) {
                        console.log('Adding column extension_id...');
                        await queryInterface.addColumn('users', 'extension_id', { type: require('sequelize').DataTypes.STRING, allowNull: true });
                    }
                    if (!userTableTelephony.pin) {
                        console.log('Adding column pin...');
                        await queryInterface.addColumn('users', 'pin', { type: require('sequelize').DataTypes.STRING, allowNull: true });
                    }
                    if (!userTableTelephony.rfid_tag) {
                        console.log('Adding column rfid_tag...');
                        await queryInterface.addColumn('users', 'rfid_tag', { type: require('sequelize').DataTypes.STRING, allowNull: true });
                    }
                    if (!userTableTelephony.personnel_number) {
                        console.log('Adding column personnel_number...');
                        await queryInterface.addColumn('users', 'personnel_number', { type: require('sequelize').DataTypes.STRING, allowNull: true });
                    }

                    console.log('Verifying time_logs table...');
                    const [timeLogTables] = await sequelize.query("SHOW TABLES LIKE 'time_logs'");
                    if (timeLogTables.length === 0) {
                        console.log('Creating time_logs table...');
                        const TimeLog = require('./domain/models/TimeLog');
                        await TimeLog.sync({ alter: true });
                    }

                    console.log('Verifying reonic_leads table...');
                    const [reonicLeadTables] = await sequelize.query("SHOW TABLES LIKE 'reonic_leads'");
                    if (reonicLeadTables.length === 0) {
                        console.log('Creating reonic_leads table...');
                        const ReonicLead = require('./domain/models/ReonicLead');
                        await ReonicLead.sync({ alter: true });
                    }

                    console.log('Verifying notifications schema...');
                    const [notificationTables] = await sequelize.query("SHOW TABLES LIKE 'notifications'");
                    if (notificationTables.length === 0) {
                        console.log('Creating notifications table...');
                        const Notification = require('./domain/models/Notification');
                        await Notification.sync({ alter: true });
                    }

                    console.log('Verifying notification_settings schema...');
                    const [notificationSettingTables] = await sequelize.query("SHOW TABLES LIKE 'notification_settings'");
                    if (notificationSettingTables.length === 0) {
                        console.log('Creating notification_settings table...');
                        const NotificationSetting = require('./domain/models/NotificationSetting');
                        await NotificationSetting.sync({ alter: true });
                    }

                    console.log('Verifying users push token column...');
                    const [userPushTokenCols] = await sequelize.query("SHOW COLUMNS FROM users LIKE 'expo_push_token'");
                    if (userPushTokenCols.length === 0) {
                        console.log('Adding expo_push_token column to users...');
                        await sequelize.query("ALTER TABLE users ADD COLUMN expo_push_token VARCHAR(255) NULL");
                    }

                    console.log('Verifying notes reminder column...');
                    const [noteReminderCols] = await sequelize.query("SHOW COLUMNS FROM notes LIKE 'reminder_notified'");
                    if (noteReminderCols.length === 0) {
                        console.log('Adding reminder_notified column to notes...');
                        await sequelize.query("ALTER TABLE notes ADD COLUMN reminder_notified BOOLEAN DEFAULT 0");
                    }

                    console.log('Verifying tasks reminder column...');
                    const [taskReminderCols] = await sequelize.query("SHOW COLUMNS FROM tasks LIKE 'reminder_notified'");
                    if (taskReminderCols.length === 0) {
                        console.log('Adding reminder_notified column to tasks...');
                        await sequelize.query("ALTER TABLE tasks ADD COLUMN reminder_notified BOOLEAN DEFAULT 0");
                    }

                    console.log('Verifying projects schema for custom client info...');
                    const [projectFirstNameCols] = await sequelize.query("SHOW COLUMNS FROM projects LIKE 'client_first_name'");
                    if (projectFirstNameCols.length === 0) {
                        console.log('Adding client_first_name column to projects...');
                        await sequelize.query("ALTER TABLE projects ADD COLUMN client_first_name VARCHAR(255) NULL");
                    }
                    const [projectLastNameCols] = await sequelize.query("SHOW COLUMNS FROM projects LIKE 'client_last_name'");
                    if (projectLastNameCols.length === 0) {
                        console.log('Adding client_last_name column to projects...');
                        await sequelize.query("ALTER TABLE projects ADD COLUMN client_last_name VARCHAR(255) NULL");
                    }
                    const [projectPhoneCols] = await sequelize.query("SHOW COLUMNS FROM projects LIKE 'client_phone'");
                    if (projectPhoneCols.length === 0) {
                        console.log('Adding client_phone column to projects...');
                        await sequelize.query("ALTER TABLE projects ADD COLUMN client_phone VARCHAR(255) NULL");
                    }
                    const [projectEmailCols] = await sequelize.query("SHOW COLUMNS FROM projects LIKE 'client_email'");
                    if (projectEmailCols.length === 0) {
                        console.log('Adding client_email column to projects...');
                        await sequelize.query("ALTER TABLE projects ADD COLUMN client_email VARCHAR(255) NULL");
                    }
                    const [projectAddressCols] = await sequelize.query("SHOW COLUMNS FROM projects LIKE 'client_address'");
                    if (projectAddressCols.length === 0) {
                        console.log('Adding client_address column to projects...');
                        await sequelize.query("ALTER TABLE projects ADD COLUMN client_address VARCHAR(255) NULL");
                    }
                    const [projectNotesCols] = await sequelize.query("SHOW COLUMNS FROM projects LIKE 'client_notes'");
                    if (projectNotesCols.length === 0) {
                        console.log('Adding client_notes column to projects...');
                        await sequelize.query("ALTER TABLE projects ADD COLUMN client_notes TEXT NULL");
                    }

                    console.log('Verifying projects schema for categories_json...');
                    let hasCategoriesJson = false;
                    try {
                        const [cols] = await sequelize.query("PRAGMA table_info(projects)");
                        hasCategoriesJson = cols.some(c => c.name === 'categories_json');
                    } catch (err) {
                        const [cols] = await sequelize.query("SHOW COLUMNS FROM projects LIKE 'categories_json'");
                        hasCategoriesJson = cols.length > 0;
                    }
                    if (!hasCategoriesJson) {
                        console.log('Adding categories_json column to projects...');
                        await sequelize.query("ALTER TABLE projects ADD COLUMN categories_json TEXT NULL");
                    }

                    console.log('Verifying categories schema for target column...');
                    let hasTarget = false;
                    try {
                        const [cols] = await sequelize.query("PRAGMA table_info(categories)");
                        hasTarget = cols.some(c => c.name === 'target');
                    } catch (err) {
                        const [cols] = await sequelize.query("SHOW COLUMNS FROM categories LIKE 'target'");
                        hasTarget = cols.length > 0;
                    }
                    if (!hasTarget) {
                        console.log('Adding target column to categories...');
                        try {
                            await sequelize.query("ALTER TABLE categories ADD COLUMN target VARCHAR(50) DEFAULT 'both' NOT NULL");
                        } catch (alterErr) {
                            await sequelize.query("ALTER TABLE categories ADD COLUMN target VARCHAR(50) DEFAULT 'both'");
                        }
                    }

                    console.log('Schema verification complete.');
                } catch (schemaErr) {
                    console.warn('Non-critical: Schema fix failed (columns might already exist):', schemaErr.message);
                }

                console.log('Running initial seeding...');
                await seedDatabase();
                console.log('Initial seeding check finished.');

                // Ensure Projektleiter role in DB does not have VIEW_CATEGORIES or VIEW_INQUIRIES permissions
                try {
                    const { Role } = require('./domain/models');
                    const plRole = await Role.findOne({ where: { name: 'Projektleiter' } });
                    if (plRole && plRole.permissions && Array.isArray(plRole.permissions)) {
                        const updatedPermissions = plRole.permissions.filter(
                            p => p !== 'VIEW_CATEGORIES' && p !== 'VIEW_INQUIRIES'
                        );
                        if (updatedPermissions.length !== plRole.permissions.length) {
                            plRole.permissions = updatedPermissions;
                            await plRole.save();
                            console.log('Successfully updated Projektleiter permissions in database to remove categories and inquiries.');
                        }
                    }
                } catch (dbErr) {
                    console.error('Non-critical: Failed to update database Projektleiter permissions:', dbErr.message);
                }
            } catch (err) {
                console.error('CRITICAL: Failed to sync/seed database:', err.message);
                // Keep the server running so we can still access it for debugging
            }
        });
    })();
}

module.exports = app;
