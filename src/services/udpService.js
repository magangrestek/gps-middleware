// src/services/udpService.js
const dgram = require('dgram');
const deadReckoning = require('./deadReckoning');
const trackingController = require('../controllers/trackingController');
const sensorDataService = require('./sensorDataService'); // Pastikan file ini ada dan sudah diimplementasikan

const udpServer = dgram.createSocket('udp4');
const PORT = process.env.UDP_PORT || 1338;

udpServer.on('message', async (msg, rinfo) => {
  try {
    const dataString = msg.toString();
    console.log(`📡 [UDP] Received data: ${dataString} from ${rinfo.address}:${rinfo.port}`);

    // 1. Parse data ke objek sensorData
    const sensorData = parseSensorData(dataString);

    // 2. Simpan data mentah (raw data) ke database
    await sensorDataService.storeRawData(sensorData, dataString);
    console.log(`✅ [UDP] Raw data stored successfully!`);

    // 3. Jalankan dead reckoning untuk menghasilkan payload final
    const finalPayload = await deadReckoning.processData(sensorData);

    // 4. Jika payload final tersedia, panggil controller untuk menindaklanjuti
    if (finalPayload) {
      trackingController.handleTracking(finalPayload);
    }
  } catch (error) {
    console.error(`[UDP] Error processing data: ${error.message}`);
  }
});

udpServer.bind(PORT, () => {
  console.log(`[UDP] Server listening on port ${PORT}`);
});

/**
 * Fungsi untuk parsing data sensor dari string.
 * Contoh format data:
 * "id:10193712,|gps:-6.241128,106.844184,59.80,|gps_speed:0.54,|accel_speed:35.29,|accelero:-1.21,0.03,9.31,-0.01,0.01,-0.01,|magnetometer:210.62"
 */
function parseSensorData(dataString) {
  const segments = dataString.split('|').map(s => s.trim());
  
  // Buat objek dengan nilai default
  const sensorData = {
    device_id: null,
    gps_lat: 0,
    gps_lon: 0,
    gps_alt: 0,
    gps_speed: 0,
    accelero_speed: 0,
    accelero_ax: 0,
    accelero_ay: 0,
    accelero_az: 0,
    accelero_gx: 0,
    accelero_gy: 0,
    accelero_gz: 0,
    magnetometer_heading: 0,
    parse_time: new Date().toISOString() // Tambahkan timestamp saat parsing
  };

  // Log data mentah untuk debugging
  console.log(`[parseSensorData] Raw segments:`, segments);
  
  segments.forEach(segment => {
    if (segment.startsWith('id:')) {
      sensorData.device_id = segment.substring(3).replace(',', '').trim();
    } else if (segment.startsWith('gps:')) {
      const gpsValues = segment.substring(4).split(',');
      // Hanya gunakan nilai GPS jika bukan 0,0,0
      const lat = parseFloat(gpsValues[0]) || 0;
      const lon = parseFloat(gpsValues[1]) || 0;
      const alt = parseFloat(gpsValues[2]) || 0;
      
      // Jika GPS menunjukkan 0,0,0 dan itu jelas tidak valid (karena perangkat tidak di tengah lautan)
      const isValidGPS = (lat !== 0 || lon !== 0);
      
      if (isValidGPS) {
        sensorData.gps_lat = lat;
        sensorData.gps_lon = lon;
        sensorData.gps_alt = alt;
        console.log(`[parseSensorData] Valid GPS: ${lat}, ${lon}, ${alt}`);
      } else {
        console.log(`[parseSensorData] Invalid GPS values (0,0,0) received, not updating GPS coordinates`);
      }
    } else if (segment.startsWith('gps_speed:')) {
      sensorData.gps_speed = parseFloat(segment.substring(10)) || 0;
    } else if (segment.startsWith('accel_speed:')) {
      sensorData.accelero_speed = parseFloat(segment.substring(12)) || 0;
    } else if (segment.startsWith('accelero:')) {
      const accelValues = segment.substring(9).split(',');
      if (accelValues.length >= 6) {
        sensorData.accelero_ax = parseFloat(accelValues[0]) || 0;
        sensorData.accelero_ay = parseFloat(accelValues[1]) || 0;
        sensorData.accelero_az = parseFloat(accelValues[2]) || 0;
        sensorData.accelero_gx = parseFloat(accelValues[3]) || 0;
        sensorData.accelero_gy = parseFloat(accelValues[4]) || 0;
        sensorData.accelero_gz = parseFloat(accelValues[5]) || 0;
      }
    } else if (segment.startsWith('magnetometer:')) {
      sensorData.magnetometer_heading = parseFloat(segment.substring(13)) || 0;
    }
  });
  
  // Log hasil parsing untuk debugging
  console.log(`[parseSensorData] Parsed data:`, JSON.stringify(sensorData, null, 2));
  
  return sensorData;
}

module.exports = udpServer;
