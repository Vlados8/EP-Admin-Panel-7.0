const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Subcontractor = sequelize.define('Subcontractor', {
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
        validate: {
            notEmpty: true
        }
    },
    trade: {
        type: DataTypes.STRING, // e.g., 'Elektrik', 'Sanitär', 'Dachdecker'
        allowNull: false
    },
    contact_person: {
        type: DataTypes.STRING,
        allowNull: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isEmail: true
        }
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    address: {
        type: DataTypes.STRING,
        allowNull: true
    },
    zip_code: {
        type: DataTypes.STRING,
        allowNull: true
    },
    city: {
        type: DataTypes.STRING,
        allowNull: true
    },
    hourly_rate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    password_hash: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'subcontractors',
    timestamps: true,
    paranoid: true, // Soft deletes
});

module.exports = Subcontractor;
