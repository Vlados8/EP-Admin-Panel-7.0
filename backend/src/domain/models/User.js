const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    specialty: {
        type: DataTypes.STRING,
        allowNull: true
    },
    password_hash: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'suspended'),
        defaultValue: 'active' // Enum mapping user state
    },
    company_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    role_id: {
        type: DataTypes.UUID,
        allowNull: true // Default role should be mapped later
    },
    manager_id: {
        type: DataTypes.UUID,
        allowNull: true // Links to another User (e.g. Gruppenleiter or Projektleiter)
    },
    storage_limit_gb: {
        type: DataTypes.FLOAT,
        defaultValue: 2.0
    },
    storage_used_bytes: {
        type: DataTypes.BIGINT,
        defaultValue: 0
    },
    last_seen_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    sip_user: {
        type: DataTypes.STRING,
        allowNull: true
    },
    sip_password: {
        type: DataTypes.STRING,
        allowNull: true
    },
    sip_domain: {
        type: DataTypes.STRING,
        allowNull: true
    },
    wss_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    is_receiving_calls: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    mobile_phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    extension_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    pin: {
        type: DataTypes.STRING,
        allowNull: true
    },
    rfid_tag: {
        type: DataTypes.STRING,
        allowNull: true
    },
    personnel_number: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'users',
    underscored: true,
    timestamps: true
});

module.exports = User;
