// src/services/deadReckoning.js
const stationModel = require('../models/stationModel');
const { haversineDistance } = require('../utils/haversineDistance');

// Variabel global untuk menyimpan posisi terakhir dan waktu update
let lastKnownPosition = { lat: 0, lon: 0 };
let lastUpdateTime = Date.now();

// Tambahkan di bagian atas file
const MAX_DATA_AGE = 10000; // 10 detik
let lastRawDataTime = Date.now();

async function processData(sensorData) {
  try {
    if (!sensorData) return null;
    // Update waktu penerimaan data mentah
    lastRawDataTime = Date.now();
    // Hitung deltaTime (s) sejak update terakhir
    const now = Date.now();
    const deltaTime = (now - lastUpdateTime) / 1000; // ms -> s

    let currentLat, currentLon;

    // 1. Jika GPS valid, update lastKnownPosition
    if (sensorData.gps_lat && sensorData.gps_lon && sensorData.gps_lat !== 0 && sensorData.gps_lon !== 0) {
      currentLat = sensorData.gps_lat;
      currentLon = sensorData.gps_lon;
      lastKnownPosition = { lat: currentLat, lon: currentLon };
      lastUpdateTime = now;
    } else {
      // 2. GPS tidak valid, gunakan IMU (accelerometer + heading) untuk perkiraan
      const estimatedPos = estimatePositionFromIMU(lastKnownPosition, sensorData, deltaTime);
      currentLat = estimatedPos.lat;
      currentLon = estimatedPos.lon;
      // Perbarui lastKnownPosition dengan posisi estimasi
      lastKnownPosition = { lat: currentLat, lon: currentLon };
      lastUpdateTime = now;
    }

    // Pilih kecepatan: gunakan gps_speed jika ada, jika 0 fallback ke accelero_speed
    const speed = (sensorData.gps_speed > 0) ? sensorData.gps_speed : sensorData.accelero_speed;
    const heading = sensorData.magnetometer_heading || 0;

    // Ambil stasiun aktif
    const stations = await stationModel.findAll({ where: { active: true } });

    let bestStation = null;
    let bestETA = Infinity;
    let bestDistance = null;

    stations.forEach(station => {
      const distance = haversineDistance(currentLat, currentLon, station.latitude, station.longitude);
      if (speed > 0) {
        const eta = (distance / speed) / 60;
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

    const finalPayload = {
      device_id: sensorData.device_id || "UNKNOWN",
      tracking: {
        timestamp: timestamp,
        position: {
          speed: speed,
          heading: heading,
          source: (sensorData.gps_lat && sensorData.gps_lon && sensorData.gps_lat !== 0 && sensorData.gps_lon !== 0)
            ? "GPS" : "DEAD_RECKONING"
        },
        prediction: {
          station_id: bestStation ? bestStation.id : null,
          station_name: bestStation ? bestStation.name : "Unknown",
          distance: bestStation ? Math.round(bestDistance) : "N/A",
          eta_minutes: bestStation ? Math.round(bestETA) : "N/A"
        }
      },
      raw_data: {
        // ... raw sensor data
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

// Tambahkan fungsi untuk mengecek keaktifan koneksi
function isConnectionActive() {
  return (Date.now() - lastRawDataTime) < MAX_DATA_AGE;
}

/**
 * Contoh fungsi sederhana untuk estimasi posisi dari IMU
 */
function estimatePositionFromIMU(lastPos, sensorData, deltaTime) {
  const speed = sensorData.accelero_speed || 0;
  const headingRad = (sensorData.magnetometer_heading || 0) * Math.PI / 180;

  const distance = speed * deltaTime;
  const deltaX = distance * Math.sin(headingRad);
  const deltaY = distance * Math.cos(headingRad);

  const latDegPerMeter = 1 / 111320;
  const lonDegPerMeter = 1 / (111320 * Math.cos(lastPos.lat * Math.PI / 180));

  const newLat = lastPos.lat + (deltaY * latDegPerMeter);
  const newLon = lastPos.lon + (deltaX * lonDegPerMeter);

  return { lat: newLat, lon: newLon };
}

module.exports = { processData, isConnectionActive};
