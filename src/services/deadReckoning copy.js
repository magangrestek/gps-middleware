// src/services/deadReckoning.js
const stationModel = require('../models/stationModel');
const { haversineDistance } = require('../utils/haversineDistance');

// Variabel global untuk menyimpan posisi terakhir dan waktu update
let lastKnownPosition = { lat: 0, lon: 0 };
let lastUpdateTime = Date.now();

// Tambahkan di bagian atas file
const MAX_DATA_AGE = 10000; // 10 detik
let lastRawDataTime = Date.now();

// Tambahkan status kedatangan dengan persistensi
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

    // Menghitung jarak ke semua stasiun
    const stationDistances = stations.map(station => {
      const distance = haversineDistance(currentLat, currentLon, station.latitude, station.longitude);
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
    
    // Konversi kecepatan untuk konsistensi jika perlu
    // Catatan: Pastikan satuan speed sudah konsisten (m/s atau km/h)

    // Cek kondisi kedatangan dengan logika persistensi
    let isArrived = false;
    
    if (speed < 2 && currentStation.distance < 100) {
      // Kereta baru tiba di stasiun
      if (!arrivalStatus.isArrived) {
        console.log(`[DeadReckoning] ARRIVAL DETECTED at station ${currentStation.station.name}! Speed: ${speed.toFixed(2)} km/h, Distance: ${currentStation.distance.toFixed(2)} m`);
        
        // Update status kedatangan
        arrivalStatus = {
          isArrived: true,
          arrivedAtStation: currentStation.station.name,
          nextStation: nextStation ? nextStation.station.name : null,
          arrivedTime: Date.now(),
          departureCooldown: 60000
        };
        
        if (nextStation) {
          console.log(`[DeadReckoning] Next station will be ${nextStation.station.name}, distance: ${nextStation.distance.toFixed(2)} m`);
        } else {
          console.log(`[DeadReckoning] No next station available, this might be the final destination`);
        }
      }
      isArrived = true;
    } else if (arrivalStatus.isArrived) {
      // Kecepatan meningkat atau jarak berubah, tapi cek cooldown
      if (Date.now() - arrivalStatus.arrivedTime <= arrivalStatus.departureCooldown) {
        // Masih dalam cooldown, tetap anggap tiba
        isArrived = true;
        console.log(`[DeadReckoning] Still in arrival cooldown for ${arrivalStatus.arrivedAtStation}, ${Math.round((arrivalStatus.departureCooldown - (Date.now() - arrivalStatus.arrivedTime))/1000)}s remaining`);
      } else {
        // Cooldown selesai, kereta dianggap sudah berangkat
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

    return finalPayload;
  } catch (error) {
    console.error("Error in deadReckoning processData:", error);
    return null;
  }
}

// Fungsi untuk mengecek keaktifan koneksi
function isConnectionActive() {
  return (Date.now() - lastRawDataTime) < MAX_DATA_AGE;
}

/**
 * Contoh fungsi sederhana untuk estimasi posisi dari IMU
 */
function estimatePositionFromIMU(lastPos, sensorData, deltaTime) {
  // Jika waktu berlalu terlalu lama, jangan lakukan estimasi
  if (deltaTime > 30) { // lebih dari 30 detik tanpa data baru
    console.log("[DeadReckoning] Too much time elapsed since last update, skipping estimation");
    return lastPos; // Kembalikan posisi terakhir tanpa estimasi
  }
  
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