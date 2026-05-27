const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const NotificationSetting = sequelize.define('NotificationSetting', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    }
}, {
    tableName: 'notification_settings',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['user_id', 'type']
        }
    ]
});

module.exports = NotificationSetting;
