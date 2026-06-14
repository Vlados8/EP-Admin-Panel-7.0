const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const ProjectStage = sequelize.define('ProjectStage', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    project_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'In Arbeit'
    },
    assigned_to_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    created_by_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    created_by_subcontractor_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    created_by_client_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'project_stages',
    timestamps: true
});

module.exports = ProjectStage;
