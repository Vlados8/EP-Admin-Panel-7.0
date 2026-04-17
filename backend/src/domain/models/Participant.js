const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Participant = sequelize.define('Participant', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    conversationId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'conversation_id'
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id'
    },
    lastReadAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_read_at'
    }
}, {
    tableName: 'participants',
    timestamps: true,
    underscored: true
});

module.exports = Participant;
