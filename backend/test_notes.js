require('dotenv').config();
const sequelize = require('./src/config/database');

async function test() {
    try {
        await sequelize.authenticate();
        console.log('Database connected!');
        
        const [notes] = await sequelize.query("SELECT id, title, project_id, user_id, subcontractor_id, show_in_diary FROM notes WHERE project_id IS NOT NULL");
        console.log('Notes with project:', JSON.stringify(notes, null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error('Error running check:', err);
        process.exit(1);
    }
}

test();
