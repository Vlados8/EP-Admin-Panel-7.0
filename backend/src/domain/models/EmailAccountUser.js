const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const EmailAccountUser = sequelize.define('EmailAccountUser', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    email_account_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'email_accounts',
            key: 'id'
        }
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    tableName: 'email_account_users',
    timestamps: true,
    underscored: true,
    paranoid: false
});

module.exports = EmailAccountUser;
