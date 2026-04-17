const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const FileAsset = sequelize.define('FileAsset', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    file_url: {
        type: DataTypes.STRING,
        allowNull: false
    },
    size: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    mime_type: {
        type: DataTypes.STRING,
        allowNull: true
    },
    is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    company_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    path: {
        type: DataTypes.STRING,
        defaultValue: ''
    },
    folder_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'file_folders',
            key: 'id'
        }
    },
    share_token: {
        type: DataTypes.UUID,
        unique: true,
        allowNull: true
    },
    is_external_shared: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'file_assets',
    underscored: true,
    timestamps: true
});

module.exports = FileAsset;
