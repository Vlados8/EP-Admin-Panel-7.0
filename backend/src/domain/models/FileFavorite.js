const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const FileFavorite = sequelize.define('FileFavorite', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    file_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'file_assets',
            key: 'id'
        }
    },
    folder_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'file_folders',
            key: 'id'
        }
    }
}, {
    tableName: 'file_favorites',
    underscored: true,
    timestamps: true
});

module.exports = FileFavorite;
