const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Message = sequelize.define('Message', {
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
    senderId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'sender_id'
    },
    text: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('text', 'image', 'video', 'file', 'voice'),
        defaultValue: 'text'
    },
    caption: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    replyToId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'reply_to_id'
    },
    reactions: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
        field: 'reactions'
    },
    isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_read'
    }
}, {
    tableName: 'messages',
    timestamps: true,
    underscored: true
});

module.exports = Message;
