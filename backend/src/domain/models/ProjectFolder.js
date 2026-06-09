const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const ProjectFolder = sequelize.define('ProjectFolder', {
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
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    path: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Relative path within the project uploads folder'
    },
    allowed_role_ids: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: null,
        comment: 'JSON array of role IDs. If null/empty, only Admins/Owner can see'
    },
    is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    visible_to_subcontractors: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    visible_to_partners: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    share_token: {
        type: DataTypes.UUID,
        unique: true,
        defaultValue: DataTypes.UUIDV4
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
    created_by_client_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'clients',
            key: 'id'
        }
    }
}, {
    tableName: 'project_folders',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['project_id', 'path', 'name']
        }
    ]
});

module.exports = ProjectFolder;
