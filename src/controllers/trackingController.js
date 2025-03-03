const deadReckoning = require('../services/deadReckoning');

// Variabel global untuk menyimpan data tracking terakhir
let latestTrackingData = null;

// Fungsi untuk memperbarui data tracking terbaru
function updateLatestTrackingData(payload) {
  latestTrackingData = payload;
  console.log("[TrackingController] Latest tracking data updated:", latestTrackingData);
}

// Fungsi untuk mengambil data tracking terbaru
function getLatestTrackingData() {
  return latestTrackingData;
}

// Fungsi yang digunakan untuk endpoint REST (jika ada)
async function getTrackingPrediction(req, res) {
  try {
    const tracking = getLatestTrackingData();
    if (tracking) {
      res.json(tracking);
    } else {
      res.status(404).json({ error: 'No tracking data available' });
    }
  } catch (error) {
    console.error("[TrackingController] Error fetching tracking data:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Fungsi handleTracking untuk dipanggil dari udpService atau service lain
function handleTracking(finalPayload) {
  console.log("[TrackingController] Handling tracking payload:", finalPayload);
  // Update data tracking terbaru
  updateLatestTrackingData(finalPayload);
  // Anda juga dapat menambahkan logika tambahan di sini, misalnya penyimpanan ke database
}

module.exports = { 
  getTrackingPrediction,
  getLatestTrackingData,  // pastikan fungsi ini di-export
  handleTracking 
};
