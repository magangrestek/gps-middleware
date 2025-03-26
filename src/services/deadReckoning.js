// src/services/deadReckoning.js
const stationModel = require('../models/stationModel'); 
const { haversineDistance } = require('../utils/haversineDistance');

// Tambahkan cache untuk tracking terakhir
let lastProcessedData = null;
let lastDataReceivedTime = Date.now();
const MAX_DATA_AGE = 10000; // 10 detik

async function processData(sensorData) {
  try {
    if (!sensorData) return null;

    lastDataReceivedTime = Date.now();
    
    // Periksa apakah data sensor ini persis sama dengan data terakhir
    if (lastProcessedData && isSameData(sensorData, lastProcessedData)) {
      console.log("[DeadReckoning] Duplicate sensor data detected, skipping processing");
      return null; // Skip pemrosesan untuk data duplikat
    }
    
    // Pilih kecepatan: gunakan gps_speed jika > 0, jika tidak gunakan accelero_speed
    const speed = sensorData.gps_speed > 0 ? sensorData.gps_speed : sensorData.accelero_speed;
    const heading = sensorData.magnetometer_heading || 0;
    
    // Ambil stasiun aktif dari database
    const stations = await stationModel.findAll({ where: { active: true } });
    
    // Menghitung jarak ke semua stasiun
    const stationDistances = stations.map(station => {
      const distance = haversineDistance(sensorData.gps_lat, sensorData.gps_lon, station.latitude, station.longitude);
      return {
        station,
        distance,
        eta: speed > 0 ? (distance / speed) / 60 : Infinity // ETA dalam menit
      };
    });
    
    // Urutkan stasiun berdasarkan jarak terdekat
    stationDistances.sort((a, b) => a.distance - b.distance);
    
    let currentStation = stationDistances[0]; // Stasiun terdekat
    let nextStation = stationDistances[1] || null; // Stasiun terdekat kedua (jika ada)
    let isArrived = false;
    
    // Cek kondisi kedatangan: kecepatan < 1 km/jam dan jarak < 100 meter
    
    
    if (speed < 1 && currentStation.distance < 100) {
      isArrived = true;
      console.log(`[DeadReckoning] ARRIVAL DETECTED at station ${currentStation.station.name}! Speed: ${speed.toFixed(2)} km/h, Distance: ${currentStation.distance.toFixed(2)} m`);
      
      // Jika sudah tiba, gunakan stasiun berikutnya untuk prediksi
      if (nextStation) {
        console.log(`[DeadReckoning] Next station will be ${nextStation.station.name}, distance: ${nextStation.distance.toFixed(2)} m`);
      } else {
        console.log(`[DeadReckoning] No next station available, this might be the final destination`);
      }
    }
    
    // Pilih stasiun dan data untuk prediksi
    let stationName, stationId, stationDistance, stationETA;
    
    if (isArrived && nextStation) {
      // Jika sudah tiba dan ada stasiun berikutnya
      stationName = `ARRIVED at ${currentStation.station.name}, Next: ${nextStation.station.name}`;
      stationId = nextStation.station.id;
      stationDistance = Math.round(nextStation.distance);
      stationETA = Math.round(nextStation.eta);
    } else if (isArrived) {
      // Jika sudah tiba tapi tidak ada stasiun berikutnya
      stationName = `ARRIVED at ${currentStation.station.name} (Final Station)`;
      stationId = currentStation.station.id;
      stationDistance = Math.round(currentStation.distance);
      stationETA = 0;
    } else {
      // Jika belum tiba
      stationName = currentStation.station.name;
      stationId = currentStation.station.id;
      stationDistance = Math.round(currentStation.distance);
      stationETA = Math.round(currentStation.eta);
    }
    
    // Buat timestamp dengan presisi tinggi
    const waktu = new Date();
    const offset = 7 * 60 * 60 * 1000; // 7 jam dalam milidetik
    const timestamp = new Date(waktu.getTime() + offset).toISOString();
    
    // Tambahkan unique ID untuk setiap tracking
    const trackingId = `${sensorData.device_id || "UNKNOWN"}_${Date.now()}`;
    
    // Buat objek finalPayload sesuai format yang diinginkan
    const finalPayload = {
      tracking_id: trackingId,
      device_id: sensorData.device_id || "UNKNOWN",
      tracking: {
        timestamp: timestamp,
        position: {
          speed: speed,
          heading: heading,
          source: "SENSOR"
        },
        prediction: {
          station_id: stationId,
          station_name: stationName,
          distance: stationDistance,
          eta_minutes: stationETA
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
    
    // Simpan data yang baru diproses
    lastProcessedData = {...sensorData};
    
    // Log data untuk debugging
    console.log(`[DeadReckoning] Generated tracking_id: ${trackingId}${isArrived ? " - ARRIVED!" : ""}`);
    
    return finalPayload;
  } catch (error) {
    console.error("Error in deadReckoning processData:", error);
    return null;
  }
}

// Fungsi untuk memeriksa apakah dua data sensor sama
function isSameData(newData, oldData) {
  // Bandingkan nilai-nilai penting
  return (
    newData.gps_lat === oldData.gps_lat &&
    newData.gps_lon === oldData.gps_lon &&
    newData.gps_speed === oldData.gps_speed &&
    newData.accelero_speed === oldData.accelero_speed &&
    newData.magnetometer_heading === oldData.magnetometer_heading
  );
}

// Fungsi untuk memeriksa apakah koneksi masih aktif
function isConnectionActive() {
  return (Date.now() - lastDataReceivedTime) < MAX_DATA_AGE;
}

module.exports = { processData, isConnectionActive };