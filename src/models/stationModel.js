const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Station = sequelize.define('stations', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING },
  latitude: { type: DataTypes.DOUBLE },
  longitude: { type: DataTypes.DOUBLE },
  active: { type: DataTypes.BOOLEAN, defaultValue: 1 },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  timestamps: false,
  tableName: 'stations'
});

module.exports = Station;
