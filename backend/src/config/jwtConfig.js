require('dotenv').config();
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    logger.error('CRITICAL: JWT_SECRET is not defined in environment variables!');
    // We provide a fallback only for development, but it's dangerous
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET must be defined in production!');
    }
}

module.exports = {
    JWT_SECRET: JWT_SECRET || 'dev_fallback_secret_keep_it_safe'
};
