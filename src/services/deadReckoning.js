// src/services/deadReckoning.js
const stationModel = require('../models/stationModel'); // Atau gunakan stationService jika ada
const { haversineDistance } = require('../utils/haversineDistance');

async function processData(sensorData) {
  try {
    if (!sensorData) return null;

    // Pilih kecepatan: gunakan accelero_speed jika > 0, jika tidak gunakan gps_speed
    // const speed = sensorData.accelero_speed > 0 ? sensorData.accelero_speed : sensorData.gps_speed;
    const speed = sensorData.gps_speed > 0 ? sensorData.gps_speed : sensorData.accelero_speed;
    const heading = sensorData.magnetometer_heading || 0;

    // Ambil stasiun aktif dari database
    const stations = await stationModel.findAll({ where: { active: true } });

    let bestStation = null;
    let bestETA = Infinity;
    let bestDistance = null;

    stations.forEach(station => {
      const distance = haversineDistance(sensorData.gps_lat, sensorData.gps_lon, station.latitude, station.longitude);
      if (speed > 0) {
        const eta = (distance / speed) / 60; // ETA dalam menit
        if (eta < bestETA) {
          bestETA = eta;
          bestStation = station;
          bestDistance = distance;
        }
      }
    });

    const waktu = new Date();
    const offset = 7 * 60 * 60 * 1000; // 7 jam dalam milidetik
    const timestamp = new Date(waktu.getTime() + offset).toISOString();


    // Buat objek finalPayload sesuai format yang diinginkan
    const finalPayload = {
      device_id: sensorData.device_id || "UNKNOWN",
      tracking: {
        timestamp: timestamp,
        position: {
          speed: speed,
          heading: heading,
          source: "SENSOR"
        },
        prediction: {
          station_id: bestStation ? bestStation.id : null,
          station_name: bestStation ? bestStation.name : "Unknown",
          distance: bestStation ? Math.round(bestDistance) : "N/A",
          eta_minutes: bestStation ? Math.round(bestETA) : "N/A"
        }
      },
      raw_data: {
        device_id: sensorData.device_id || "UNKNOWN",
        gps_lat: sensorData.gps_lat,
        gps_lon: sensorData.gps_lon,
        gps_alt: sensorData.gps_alt,
        gps_speed: sensorData.gps_speed,
        accelero_speed: sensorData.accelero_speed,
        accelero_ax: sensorData.accelero_ax,
        accelero_ay: sensorData.accelero_ay,
        accelero_az: sensorData.accelero_az,
        accelero_gx: sensorData.accelero_gx,
        accelero_gy: sensorData.accelero_gy,
        accelero_gz: sensorData.accelero_gz,
        magnetometer_heading: sensorData.magnetometer_heading
      }
    };

    return finalPayload;
  } catch (error) {
    console.error("Error in deadReckoning processData:", error);
    return null;
  }
}

module.exports = { processData };
