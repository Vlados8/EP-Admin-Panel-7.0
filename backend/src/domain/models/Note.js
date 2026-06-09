const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Note = sequelize.define('Note', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    time: {
        type: DataTypes.STRING,
        allowNull: true
    },
    color: {
        type: DataTypes.STRING,
        defaultValue: 'blue',
        allowNull: false
    },
    project_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    subcontractor_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    client_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'clients',
            key: 'id'
        }
    },
    isDone: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isPinned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    showInDiary: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    }
}, {
    tableName: 'notes',
    timestamps: true,
    paranoid: true, // Soft deletes
});

module.exports = Note;
