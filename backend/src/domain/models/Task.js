const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Task = sequelize.define('Task', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
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
        type: DataTypes.ENUM('In Arbeit', 'Erledigt', 'Warten'),
        defaultValue: 'In Arbeit'
    },
    project_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    start_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    due_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    time: {
        type: DataTypes.STRING,
        allowNull: true
    },
    assigned_to_id: {
        type: DataTypes.UUID,
        allowNull: true // User ID doing the task
    },
    assigned_subcontractor_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    created_by_id: {
        type: DataTypes.UUID,
        allowNull: false // User ID assigning the task or creating it
    }
}, {
    tableName: 'tasks',
    timestamps: true,
    paranoid: true, // Soft deletes
});

module.exports = Task;
