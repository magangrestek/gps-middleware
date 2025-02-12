const { calculateNearestStation } = require('../services/deadReckoning');

let latestTrackingData = null; // Menyimpan data terbaru untuk dikirim ke cloud

exports.getTrackingPrediction = async (req, res) => {
  try {
    const { lat, lon, speed, heading } = req.query;

    const result = await calculateNearestStation(
      lat ? parseFloat(lat) : null,
      lon ? parseFloat(lon) : null,
      parseFloat(speed) || 0,
      parseFloat(heading) || 0
    );

    const trackingData = {
      tracking: {
        timestamp: new Date().toISOString(),
        position: {
          latitude: result.position_source === 'GPS' ? parseFloat(lat) : result.lat,
          longitude: result.position_source === 'GPS' ? parseFloat(lon) : result.lon,
          speed: parseFloat(speed) || 0,
          heading: parseFloat(heading) || 0,
          source: result.position_source
        },
        prediction: {
          station_id: result.station_id,
          station_name: result.station_name,
          distance: result.distance,
          eta_minutes: result.eta_minutes
        }
      }
    };

    latestTrackingData = trackingData; // Simpan data terbaru

    res.json(trackingData);
  } catch (error) {
    console.error('❌ Error in tracking prediction:', error);
    res.status(500).json({ error: 'Failed to calculate tracking prediction' });
  }
};

// Fungsi untuk mendapatkan data tracking terbaru
exports.getLatestTrackingData = () => latestTrackingData;
