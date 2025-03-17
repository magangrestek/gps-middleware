// src/services/sensorDataService.js
const RawData = require('../models/rawDataModel');

async function storeRawData(sensorData, rawMessage) {
  try {
    await RawData.create({
      sensor_id: sensorData.device_id || "UNKNOWN",
      gps_lat: sensorData.gps_lat,
      gps_lon: sensorData.gps_lon,
      gps_alt: sensorData.gps_alt,
      gps_speed: sensorData.gps_speed,
      accelero_ax: sensorData.accelero_ax,
      accelero_ay: sensorData.accelero_ay,
      accelero_az: sensorData.accelero_az,
      accelero_gx: sensorData.accelero_gx,
      accelero_gy: sensorData.accelero_gy,
      accelero_gz: sensorData.accelero_gz,
      accelero_speed: sensorData.accelero_speed,
      magnetometer_heading: sensorData.magnetometer_heading,
      raw_message: rawMessage
    });
  } catch (error) {
    console.error("Error saving sensor data:", error);
  }
}

module.exports = { storeRawData };
