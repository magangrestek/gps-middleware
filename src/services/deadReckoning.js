// src/services/deadReckoning.js
const stationModel = require('../models/stationModel'); 
const { haversineDistance } = require('../utils/haversineDistance');

// Tambahkan cache untuk tracking terakhir
let lastProcessedData = null;
let lastDataReceivedTime = Date.now();
const MAX_DATA_AGE = 10000; // 10 detik

// Tambahkan variabel global untuk status kedatangan
let arrivalStatus = {
  isArrived: false,
  arrivedAtStation: null,
  nextStation: null,
  arrivedTime: null,
  departureCooldown: 60000 // 60 detik cooldown
};

async function processData(sensorData) {
  try {
    if (!sensorData) return null;

    lastDataReceivedTime = Date.now();
    
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
    
    
    // Cek kondisi kedatangan dengan logika yang lebih stabil
    let isArrived = false;
    
    // Periksa kondisi kecepatan rendah dan jarak dekat
    const isSlowSpeed = speed < 2; // Gunakan 2 km/h sebagai batas
    const isNearStation = currentStation.distance < 100;
    
    if (isSlowSpeed && isNearStation) {
      // Kereta baru tiba di stasiun
      if (!arrivalStatus.isArrived) {
        console.log(`[DeadReckoning] ARRIVAL DETECTED at station ${currentStation.station.name}! Speed: ${speed.toFixed(2)} km/h, Distance: ${currentStation.distance.toFixed(2)} m`);
        
        // Jika sudah tiba, gunakan stasiun berikutnya untuk prediksi
        if (nextStation) {
          console.log(`[DeadReckoning] Next station will be ${nextStation.station.name}, distance: ${nextStation.distance.toFixed(2)} m`);
        } else {
          console.log(`[DeadReckoning] No next station available, this might be the final destination`);
        }
        
        // Update status kedatangan
        arrivalStatus = {
          isArrived: true,
          arrivedAtStation: currentStation.station.name,
          nextStation: nextStation ? nextStation.station.name : null,
          arrivedTime: Date.now(),
          departureCooldown: 60000
        };
      }
      isArrived = true;
    } else if (arrivalStatus.isArrived) {
      // Sudah tiba sebelumnya, periksa apakah dalam cooldown
      if (Date.now() - arrivalStatus.arrivedTime <= arrivalStatus.departureCooldown) {
        // Masih dalam cooldown, tetap anggap tiba
        isArrived = true;
        console.log(`[DeadReckoning] Still in arrival cooldown for ${currentStation.station.name}, ${Math.round((arrivalStatus.departureCooldown - (Date.now() - arrivalStatus.arrivedTime))/1000)}s remaining`);
      } else {
        // Cooldown selesai, reset status kedatangan
        console.log(`[DeadReckoning] Departure detected from station ${arrivalStatus.arrivedAtStation}`);
        arrivalStatus = {
          isArrived: false,
          arrivedAtStation: null,
          nextStation: null,
          arrivedTime: null,
          departureCooldown: 60000
        };
      }
    }
    
    // Pilih stasiun dan data untuk prediksi
    let stationName, stationId, stationDistance, stationETA;
    
    if (isArrived && arrivalStatus.nextStation) {
      // Jika sudah tiba dan ada stasiun berikutnya
      stationName = `ARRIVED at ${arrivalStatus.arrivedAtStation}, Next: ${arrivalStatus.nextStation}`;
      
      // Cari stasiun berikutnya dari list
      const nextStationObj = stationDistances.find(s => s.station.name === arrivalStatus.nextStation);
      if (nextStationObj) {
        stationId = nextStationObj.station.id;
        stationDistance = Math.round(nextStationObj.distance);
        stationETA = Math.round(nextStationObj.eta);
      } else {
        // Fallback jika stasiun berikutnya tidak ditemukan
        stationId = nextStation ? nextStation.station.id : currentStation.station.id;
        stationDistance = Math.round(nextStation ? nextStation.distance : currentStation.distance);
        stationETA = Math.round(nextStation ? nextStation.eta : 0);
      }
    } else if (isArrived) {
      // Jika sudah tiba tapi tidak ada stasiun berikutnya
      stationName = `ARRIVED at ${arrivalStatus.arrivedAtStation || currentStation.station.name} (Final Station)`;
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
    
    // Kemudian lanjutkan dengan kode yang sama untuk membuat payload
    const waktu = new Date();
    const offset = 7 * 60 * 60 * 1000; // 7 jam dalam milidetik
    const timestamp = new Date(waktu.getTime() + offset).toISOString();
    
    const trackingId = `${sensorData.device_id || "UNKNOWN"}_${Date.now()}`;
    
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