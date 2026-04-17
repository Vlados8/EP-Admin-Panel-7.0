const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Conversation = sequelize.define('Conversation', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: true // Only for group chats
    },
    isGroup: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_group'
    },
    companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'company_id'
    },
    avatar: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'conversations',
    timestamps: true,
    underscored: true
});

module.exports = Conversation;
