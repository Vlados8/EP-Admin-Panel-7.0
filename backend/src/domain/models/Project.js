const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Project = sequelize.define('Project', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    project_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    internal_description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    budget: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0
    },
    estimated_costs: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0
    },
    address: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'aktiv' // angebot, aktiv, pausiert, abgeschlossen, storniert
    },
    progress: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0,
            max: 100
        }
    },
    start_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    end_date: {
        type: DataTypes.DATE,
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
    main_image: {
        type: DataTypes.STRING,
        allowNull: true
    },
    category_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'categories',
            key: 'id'
        }
    },
    subcategory_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'subcategories',
            key: 'id'
        }
    },
    categories_json: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    created_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    client_first_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    client_last_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    client_phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    client_email: {
        type: DataTypes.STRING,
        allowNull: true
    },
    client_address: {
        type: DataTypes.STRING,
        allowNull: true
    },
    client_notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'projects',
    timestamps: true
});

module.exports = Project;
