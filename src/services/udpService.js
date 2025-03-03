// src/services/udpService.js
const dgram = require('dgram');
const deadReckoning = require('./deadReckoning');
const trackingController = require('../controllers/trackingController');

const udpServer = dgram.createSocket('udp4');
const PORT = process.env.UDP_PORT || 1338;

udpServer.on('message', async (msg, rinfo) => {
  try {
    const dataString = msg.toString();
    console.log(`📡 [UDP] Received data: ${dataString} from ${rinfo.address}:${rinfo.port}`);

    // 1. Parse data ke objek sensorData
    const sensorData = parseSensorData(dataString);

    // 2. Jalankan dead reckoning untuk menghasilkan payload final
    const finalPayload = await deadReckoning.processData(sensorData);

    // 3. Jika payload final tersedia, panggil controller untuk menindaklanjuti
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
    magnetometer_heading: 0
  };

  segments.forEach(segment => {
    if (segment.startsWith('id:')) {
      sensorData.device_id = segment.substring(3).replace(',', '').trim();
    } else if (segment.startsWith('gps:')) {
      const [lat, lon, alt] = segment.substring(4).split(',');
      sensorData.gps_lat = parseFloat(lat) || 0;
      sensorData.gps_lon = parseFloat(lon) || 0;
      sensorData.gps_alt = parseFloat(alt) || 0;
    } else if (segment.startsWith('gps_speed:')) {
      sensorData.gps_speed = parseFloat(segment.substring(10)) || 0;
    } else if (segment.startsWith('accel_speed:')) {
      sensorData.accelero_speed = parseFloat(segment.substring(12)) || 0;
    } else if (segment.startsWith('accelero:')) {
      const [ax, ay, az, gx, gy, gz] = segment.substring(9).split(',');
      sensorData.accelero_ax = parseFloat(ax) || 0;
      sensorData.accelero_ay = parseFloat(ay) || 0;
      sensorData.accelero_az = parseFloat(az) || 0;
      sensorData.accelero_gx = parseFloat(gx) || 0;
      sensorData.accelero_gy = parseFloat(gy) || 0;
      sensorData.accelero_gz = parseFloat(gz) || 0;
    } else if (segment.startsWith('magnetometer:')) {
      sensorData.magnetometer_heading = parseFloat(segment.substring(13)) || 0;
    }
  });

  return sensorData;
}

module.exports = udpServer;
