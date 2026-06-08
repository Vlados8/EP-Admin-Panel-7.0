const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Client = sequelize.define('Client', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    company_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    contact_person: {
        type: DataTypes.STRING,
        allowNull: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isEmail: true
        }
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    address: {
        type: DataTypes.STRING,
        allowNull: true
    },
    zip_code: {
        type: DataTypes.STRING,
        allowNull: true
    },
    city: {
        type: DataTypes.STRING,
        allowNull: true
    },
    type: {
        type: DataTypes.ENUM('company', 'private'),
        defaultValue: 'company'
    },
    client_partner: {
        type: DataTypes.ENUM('client', 'partner'),
        allowNull: false,
        defaultValue: 'client'
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'lead'),
        defaultValue: 'active'
    },
    source: {
        type: DataTypes.ENUM('funnelforms', 'admin_panel'),
        defaultValue: 'funnelforms'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    password_hash: {
        type: DataTypes.STRING,
        allowNull: true // True because admin-created clients might not have a password initially
    },
    is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false // False by default until they confirm their email or an admin verifies them
    }
}, {
    tableName: 'clients',
    timestamps: true,
    paranoid: true, // Soft deletes
});

module.exports = Client;
