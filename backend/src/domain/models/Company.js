const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Company = sequelize.define('Company', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    billing_plan: {
        type: DataTypes.ENUM('free', 'pro', 'enterprise'),
        defaultValue: 'pro'
    },
    settings: {
        type: DataTypes.JSON,
        allowNull: true,
        get() {
            const rawValue = this.getDataValue('settings');
            // Support double-stringified JSON which can happen in some MariaDB/MySQL environments
            if (typeof rawValue === 'string') {
                try {
                    return JSON.parse(rawValue);
                } catch (e) {
                    return {};
                }
            }
            return rawValue || {};
        }
    }
}, {
    tableName: 'companies'
});

module.exports = Company;
