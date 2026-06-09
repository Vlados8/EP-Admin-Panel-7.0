require('dotenv').config();
const sequelize = require('./src/config/database');

async function test() {
    try {
        await sequelize.authenticate();
        console.log('Database connected!');
        
        const [projects] = await sequelize.query("SELECT id, project_number, title, client_id FROM projects LIMIT 5");
        console.log('Projects:', projects);

        const [folders] = await sequelize.query("SELECT id, project_id, name, path, visible_to_partners, visible_to_subcontractors, created_by_client_id FROM project_folders LIMIT 20");
        console.log('Folders:', folders);

        const [files] = await sequelize.query("SELECT id, project_id, name, path, created_by_client_id FROM project_files LIMIT 20");
        console.log('Files:', files);
        
        process.exit(0);
    } catch (err) {
        console.error('Error running check:', err);
        process.exit(1);
    }
}

test();
