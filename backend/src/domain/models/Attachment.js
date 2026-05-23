const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Attachment = sequelize.define('Attachment', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    email_id: {
        type: DataTypes.UUID,
        allowNull: true // Changed to support Inquiry attachments
    },
    inquiry_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    note_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    task_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    file_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    file_url: {
        type: DataTypes.STRING,
        allowNull: false
    },
    thumb_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    original_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    file_size: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    content_type: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'attachments',
    timestamps: true,
    underscored: true
});

module.exports = Attachment;
