const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const CallLog = sequelize.define('CallLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    call_id: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    direction: {
        type: DataTypes.ENUM('inbound', 'outbound'),
        allowNull: false
    },
    remote_number: {
        type: DataTypes.STRING,
        allowNull: false
    },
    duration_seconds: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    status: {
        type: DataTypes.ENUM('completed', 'missed', 'failed', 'busy', 'no-answer'),
        defaultValue: 'completed'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'call_logs',
    underscored: true,
    timestamps: true,
    updatedAt: false
});

module.exports = CallLog;
