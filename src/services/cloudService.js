const axios = require('axios');
require('dotenv').config();

async function sendToCloud(data) {
  try {
    console.log(`📡 [Cloud] Sending data to cloud at: ${process.env.CLOUD_ENDPOINT}`);
    console.log('🔄 [Cloud] Payload:', JSON.stringify(data, null, 2));

    const response = await axios.post(process.env.CLOUD_ENDPOINT, data, {
      timeout: 5000 // Timeout 5 detik untuk memastikan tidak menggantung
    });

    console.log(`✅ [Cloud] Data successfully sent at ${new Date().toISOString()}`);
    console.log('🌍 [Cloud] Cloud Response:', response.status, response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ [Cloud] Error sending data at ${new Date().toISOString()}`);
    console.error('⚠️ [Cloud] Error Message:', error.message);

    if (error.response) {
      console.error('🛑 [Cloud] Server Response:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('⚠️ [Cloud] No response received from cloud server.');
    } else {
      console.error('❓ [Cloud] Unexpected error:', error.message);
    }

    throw error;
  }
}

module.exports = sendToCloud;
