const { sequelize, User } = require('../../domain/models');

async function syncSchema() {
    console.log('--- Database Schema Synchronization Start ---');
    const queryInterface = sequelize.getQueryInterface();
    
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        const tables = await queryInterface.showAllTables();
        console.log('Existing tables:', tables);

        // 1. Check/Create users table columns
        const userTableInfo = await queryInterface.describeTable('users');
        
        const requiredColumns = [
            { name: 'is_receiving_calls', type: 'BOOLEAN', defaultValue: false },
            { name: 'mobile_phone', type: 'STRING', allowNull: true },
            { name: 'extension_id', type: 'STRING', allowNull: true },
            { name: 'pin', type: 'STRING', allowNull: true },
            { name: 'rfid_tag', type: 'STRING', allowNull: true },
            { name: 'sip_user', type: 'STRING', allowNull: true },
            { name: 'sip_password', type: 'STRING', allowNull: true },
            { name: 'sip_domain', type: 'STRING', allowNull: true },
            { name: 'wss_url', type: 'STRING', allowNull: true },
            { name: 'last_seen_at', type: 'DATE', allowNull: true },
            { name: 'storage_limit_gb', type: 'FLOAT', defaultValue: 2.0 },
            { name: 'storage_used_bytes', type: 'BIGINT', defaultValue: 0 }
        ];

        for (const col of requiredColumns) {
            if (!userTableInfo[col.name]) {
                console.log(`Adding column '${col.name}' to users table...`);
                const options = { allowNull: col.allowNull === undefined ? true : col.allowNull };
                if (col.defaultValue !== undefined) options.defaultValue = col.defaultValue;
                
                let type;
                if (col.type === 'BOOLEAN') type = require('sequelize').DataTypes.BOOLEAN;
                else if (col.type === 'STRING') type = require('sequelize').DataTypes.STRING;
                else if (col.type === 'DATE') type = require('sequelize').DataTypes.DATE;
                else if (col.type === 'FLOAT') type = require('sequelize').DataTypes.FLOAT;
                else if (col.type === 'BIGINT') type = require('sequelize').DataTypes.BIGINT;

                await queryInterface.addColumn('users', col.name, {
                    type,
                    ...options
                });
            } else {
                console.log(`Column '${col.name}' already exists.`);
            }
        }

        // 2. Check/Create time_logs table
        if (!tables.includes('time_logs')) {
            console.log('Creating time_logs table...');
            const TimeLog = require('../domain/models/TimeLog');
            await TimeLog.sync({ alter: true });
        } else {
            console.log('time_logs table already exists.');
        }

        // 3. Verify other critical tables
        const criticalTables = ['call_logs', 'clients', 'projects'];
        for (const table of criticalTables) {
            if (!tables.includes(table)) {
                console.warn(`WARNING: Critical table '${table}' is missing! Syncing models...`);
                // Find the model
                const modelName = table.split('_').map(p => p[0].toUpperCase() + p.slice(1).replace(/s$/, '')).join('');
                const models = require('../domain/models');
                if (models[modelName]) {
                    await models[modelName].sync({ alter: true });
                }
            }
        }

        console.log('--- Database Schema Synchronization Success ---');
        process.exit(0);
    } catch (error) {
        console.error('--- Database Schema Synchronization FAILED ---');
        console.error(error);
        process.exit(1);
    }
}

syncSchema();
