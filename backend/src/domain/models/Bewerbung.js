const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Bewerbung = sequelize.define('Bewerbung', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    company_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    stelle: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isEmail: true
        }
    },
    telefon: {
        type: DataTypes.STRING,
        allowNull: false
    },
    erfahrung: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    nachricht: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Neu'
    },
    source_website: {
        type: DataTypes.STRING,
        allowNull: true
    },
    notizen: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'bewerbungen',
    timestamps: true
});

module.exports = Bewerbung;
