const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const FileFolder = sequelize.define('FileFolder', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    parent_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'file_folders',
            key: 'id'
        }
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    company_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
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
    tableName: 'file_folders',
    underscored: true,
    timestamps: true
});

module.exports = FileFolder;
