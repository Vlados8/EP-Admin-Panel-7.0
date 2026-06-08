require('dotenv').config();
const sequelize = require('./src/config/database');

async function test() {
    try {
        await sequelize.authenticate();
        console.log('Database connected!');
        
        const [clientCols] = await sequelize.query("SHOW COLUMNS FROM clients");
        console.log('Client columns:', clientCols);
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

test();
