const { User, Role } = require('./src/domain/models');
const sequelize = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function testAllLogins() {
    try {
        await sequelize.authenticate();
        console.log('Database connected successfully.');

        const emails = [
            'admin@ep-bau.de',
            'test@mail.empire-premium.de',
            'admin@example.com',
            'admin@mail.empire-premium.de'
        ];
        const password = 'admin123';

        for (const email of emails) {
            console.log(`\nTesting email: '${email}'`);
            const user = await User.findOne({
                where: { email },
                include: [{ model: Role, as: 'role' }]
            });

            if (!user) {
                console.log(`FAIL: User '${email}' not found.`);
                continue;
            }

            console.log(`User found. Status: '${user.status}', Role: '${user.role ? user.role.name : 'NO ROLE'}'`);
            if (user.status !== 'active') {
                console.log(`FAIL: Status is not active.`);
                continue;
            }

            const isMatch = await bcrypt.compare(password, user.password_hash);
            console.log(`Password match: ${isMatch}`);
            if (isMatch) {
                console.log(`SUCCESS: Auth passed for ${email}!`);
            } else {
                console.log(`FAIL: Password mismatch for ${email}.`);
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Exception:', error);
        process.exit(1);
    }
}

testAllLogins();
