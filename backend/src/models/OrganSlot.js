
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OrganSlot = sequelize.define('OrganSlot', {
    id: {
      type: DataTypes.TEXT,
      primaryKey: true,
      allowNull: false,
    },
    organ_id: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    section: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        isIn: [['ritmica', 'armonica', 'solistica', 'orchestrale']],
      },
    },
    instrument: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: { min: 1 },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    order_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    created_at: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'organ_slots',
    timestamps: false,
    underscored: true,
  });

  OrganSlot.associate = (models) => {
    OrganSlot.belongsTo(models.Organ, {
      foreignKey: 'organ_id',
      as: 'organ',
    });
  };

  return OrganSlot;
};