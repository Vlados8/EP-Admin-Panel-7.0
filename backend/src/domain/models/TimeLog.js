const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const TimeLog = sequelize.define('TimeLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    worker_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    project_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'projects',
            key: 'id'
        }
    },
    project_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    check_in_time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    check_out_time: {
        type: DataTypes.DATE,
        allowNull: true
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    total_hours: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    break_deducted: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    status: {
        type: DataTypes.ENUM('open', 'closed'),
        defaultValue: 'open'
    },
    type: {
        type: DataTypes.ENUM('work', 'vacation', 'sick', 'holiday', 'work_free'),
        defaultValue: 'work'
    }
}, {
    tableName: 'time_logs',
    underscored: true,
    timestamps: true
});

module.exports = TimeLog;
