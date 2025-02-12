const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RawData = sequelize.define('raw_data', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  log_time: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  gps_lat: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
  gps_lon: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
  gps_alt: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
  accelero_ax: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
  accelero_ay: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
  accelero_az: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
  accelero_gx: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
  accelero_gy: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
  accelero_gz: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
  accelero_speed: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
  magnetometer_heading: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0.0 },
  raw_message: { type: DataTypes.TEXT, allowNull: false }
}, {
  timestamps: false,
  tableName: 'raw_data'
});

module.exports = RawData;
