const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const ReonicLead = sequelize.define('ReonicLead', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    company_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    reonicId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'new' // 'new', 'processing', 'converted', 'rejected'
    },
    customerData: {
        type: DataTypes.JSON,
        allowNull: true
    },
    systemData: {
        type: DataTypes.JSON,
        allowNull: true
    },
    rawJson: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    tableName: 'reonic_leads',
    timestamps: true
});

module.exports = ReonicLead;
