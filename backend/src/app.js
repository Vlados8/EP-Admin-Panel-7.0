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
      "img-src": ["'self'", "data:", "http://localhost:3001", "http://localhost:3000", "https://ui-avatars.com", "https://*.empire-premium.de", "https://*.empire-premium-bau.de", "https://*.railway.app"],
      "script-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      "style-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"]
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
    const userRoutes = require('./infrastructure/routes/userRoutes');
    const roleRoutes = require('./infrastructure/routes/roleRoutes');
    const noteRoutes = require('./infrastructure/routes/noteRoutes');
    const taskRoutes = require('./infrastructure/routes/taskRoutes');
    const subcontractorRoutes = require('./infrastructure/routes/subcontractorRoutes');
    const clientRoutes = require('./infrastructure/routes/clientRoutes');
    const categoryRoutes = require('./infrastructure/routes/categoryRoutes');
    const inquiryRoutes = require('./infrastructure/routes/inquiryRoutes');
    const projectRoutes = require('./infrastructure/routes/projectRoutes');
    const supportRoutes = require('./infrastructure/routes/supportRoutes');
    const emailRoutes = require('./infrastructure/routes/emailRoutes');
    const publicRoutes = require('./infrastructure/routes/publicRoutes');
    const dashboardRoutes = require('./infrastructure/routes/dashboardRoutes');

    // --- PUBLIC WEBHOOKS ---
    // CRM Integrations (e.g. MyGo) - Uses simple multer for attachments
    const upload = require('multer')();
    app.post('/api/v1/integrations/mygo', upload.any(), require('./infrastructure/controllers/IntegrationController').handleMyGoWebhook);
    
    // Public Shared Folder Routes (NO AUTH)
    app.use('/api/v1/public', publicRoutes);
    // -----------------------

    app.use('/api/v1/auth', authRoutes);
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
    app.use('/api/v1/project-stages', require('./infrastructure/routes/projectStageRoutes'));
    app.use('/api/v1/support', supportRoutes);
    app.use('/api/v1/emails', emailRoutes);
    app.use('/api/v1/dashboard', dashboardRoutes);

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
        const { ProjectFolder, ProjectFile, User } = require('./domain/models');

        const PORT = process.env.PORT || 3000;

        // Start listening IMMEDIATELY so Railway healthcheck finds an open port
        server.listen(PORT, '0.0.0.0', async () => {
            console.log(`Server is now listening on port ${PORT}`);
            logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);

            // Perform DB sync/seed in background/after listen
            const sequelize = require('./config/database');
            const seedDatabase = require('./infrastructure/database/seeder');
            try {
                console.log('Connecting to database and synchronizing...');
                await sequelize.sync({ alter: false });
                console.log('Database synchronized successfully.');

                // MANUALLY FIX missing columns to resolve "Unknown column 'user_id'"
                try {
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

                    console.log('Schema verification complete.');
                } catch (schemaErr) {
                    console.warn('Non-critical: Schema fix failed (columns might already exist):', schemaErr.message);
                }

                console.log('Running initial seeding...');
                await seedDatabase();
                console.log('Initial seeding check finished.');
            } catch (err) {
                console.error('CRITICAL: Failed to sync/seed database:', err.message);
                // Keep the server running so we can still access it for debugging
            }
        });
    })();
}

module.exports = app;
