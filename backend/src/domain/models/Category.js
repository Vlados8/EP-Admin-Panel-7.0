const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Category = sequelize.define('Category', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    company_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true }
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    icon: {
        type: DataTypes.STRING,
        allowNull: true // e.g. 'fa-solar-panel'
    },
    order_index: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    target: {
        type: DataTypes.ENUM('site', 'admin', 'both'),
        defaultValue: 'both',
        allowNull: false
    }
}, {
    tableName: 'categories',
    timestamps: true,
    paranoid: true,
});

module.exports = Category;
