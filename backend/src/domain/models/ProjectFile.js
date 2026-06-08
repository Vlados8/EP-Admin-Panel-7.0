const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const ProjectFile = sequelize.define('ProjectFile', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    project_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'projects',
            key: 'id'
        }
    },
    folder_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'project_folders',
            key: 'id'
        },
        comment: 'If null, file is in the project root'
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    path: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Relative path within the project uploads folder (excluding the filename)'
    },
    size: {
        type: DataTypes.BIGINT,
         allowNull: true
    },
    mime_type: {
        type: DataTypes.STRING,
        allowNull: true
    },
    created_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    created_by_subcontractor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'subcontractors',
            key: 'id'
        }
    },
    file_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Public URL of the file (e.g. R2 URL)'
    }
}, {
    tableName: 'project_files',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['project_id', 'path', 'name']
        }
    ]
});

module.exports = ProjectFile;
