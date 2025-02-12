const Station = require('../models/stationModel');
const { haversineDistance } = require('../utils/haversineDistance');

let lastKnownPosition = null; // Simpan posisi terakhir saat GPS tersedia
let lastUpdateTime = null; // Simpan timestamp terakhir saat GPS tersedia

/**
 * Menentukan lokasi berdasarkan data terbaru atau prediksi
 */
async function getEstimatedPosition(lat, lon, speed, heading) {
  const currentTime = Date.now();
  
  if (lat && lon) {
    // Jika GPS tersedia, simpan posisi terakhir
    lastKnownPosition = { lat, lon };
    lastUpdateTime = currentTime;
    return { lat, lon, source: 'GPS' };
  }

  if (!lastKnownPosition) {
    return { lat: null, lon: null, source: 'UNKNOWN' }; // Tidak bisa diprediksi tanpa data sebelumnya
  }

  // Jika GPS hilang, gunakan dead reckoning berdasarkan speed & heading terakhir
  const timeElapsed = (currentTime - lastUpdateTime) / 1000; // Waktu dalam detik
  const distanceTraveled = (speed / 3.6) * timeElapsed; // Konversi km/h ke m/s lalu hitung jarak

  const earthRadius = 6371000; // Radius bumi dalam meter
  const headingRad = (heading * Math.PI) / 180; // Konversi heading ke radian

  // Perkiraan latitude dan longitude baru
  const estimatedLat = lastKnownPosition.lat + (distanceTraveled / earthRadius) * (180 / Math.PI) * Math.cos(headingRad);
  const estimatedLon = lastKnownPosition.lon + (distanceTraveled / earthRadius) * (180 / Math.PI) * Math.sin(headingRad) / Math.cos(lastKnownPosition.lat * Math.PI / 180);

  return { lat: estimatedLat, lon: estimatedLon, source: 'DEAD_RECKONING' };
}

/**
 * Menentukan stasiun terdekat berdasarkan posisi yang tersedia
 */
async function calculateNearestStation(lat, lon, speed, heading) {
  const estimatedPos = await getEstimatedPosition(lat, lon, speed, heading);

  if (!estimatedPos.lat || !estimatedPos.lon) {
    return {
      station_id: null,
      station_name: "Unknown",
      distance: "N/A",
      eta_minutes: "N/A",
      position_source: estimatedPos.source
    };
  }

  const stations = await Station.findAll();
  let nearestStation = null;
  let minDistance = Infinity;

  for (const station of stations) {
    const distance = haversineDistance(estimatedPos.lat, estimatedPos.lon, station.latitude, station.longitude);
    if (distance < minDistance) {
      minDistance = distance;
      nearestStation = station;
    }
  }

  const eta_minutes = speed > 0 ? Math.round(minDistance / (speed / 3.6)) : "Unknown";

  return {
    station_id: nearestStation ? nearestStation.id : null,
    station_name: nearestStation ? nearestStation.name : "Unknown",
    distance: minDistance.toFixed(2),
    eta_minutes,
    position_source: estimatedPos.source
  };
}

module.exports = { calculateNearestStation };
