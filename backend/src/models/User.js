const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.TEXT,
      primaryKey: true,
      allowNull: false,
    },
    email: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password_hash: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    full_name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    role: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'user',
      validate: { isIn: [['admin', 'user']] },
    },
    status: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'active',
      validate: { isIn: [['active', 'inactive', 'suspended']] },
    },
    profile_picture: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    last_login: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    login_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    locked_until: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reset_token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reset_token_expiry: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'users',
    timestamps: false,
    underscored: true,
  });

  User.associate = (models) => {
    // Associazioni future
  };

  return User;
};
