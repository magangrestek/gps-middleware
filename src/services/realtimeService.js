const sendToCloud = require('./cloudService');
const { getLatestTrackingData } = require('../controllers/trackingController');

async function processAndSendData() {
  console.log('📡 [RealtimeService] Worker started for real-time cloud updates...');

  setInterval(async () => {
    try {
      const trackingData = getLatestTrackingData();

      if (!trackingData) {
        console.log('[RealtimeService] No new tracking data available.');
        return;
      }

      console.log('[RealtimeService] Sending real-time tracking data to cloud...');
      await sendToCloud(trackingData);
      
      console.log('[RealtimeService] Data successfully sent to cloud!');

    } catch (error) {
      console.error('[RealtimeService] Error processing real-time tracking data:', error.message);
    }
  }, 1000); // Ubah interval sesuai kebutuhan
}

module.exports = { processAndSendData };
