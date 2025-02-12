const dgram = require('dgram');
const RawData = require('../models/rawDataModel');

const udpServer = dgram.createSocket('udp4');
const PORT = process.env.UDP_PORT || 1338;

// Fungsi untuk validasi angka
const isValidNumber = (value) => {
  const num = parseFloat(value);
  return !isNaN(num) && isFinite(num);
};

udpServer.on('message', async (msg, rinfo) => {
  try {
    const dataString = msg.toString();
    console.log(`📡 [UDP] Received data: ${dataString}`);

    const [gpsData, acceleroData, magnetoData] = dataString.split('|');

    if (!gpsData || !acceleroData || !magnetoData) {
      throw new Error('Invalid UDP Data Format');
    }

    const gps = gpsData.split(',');
    const accelero = acceleroData.split(',');
    const magneto = magnetoData.split(',');

    const gps_lat = isValidNumber(gps[0]) ? parseFloat(gps[0]) : 0.0;
    const gps_lon = isValidNumber(gps[1]) ? parseFloat(gps[1]) : 0.0;
    const gps_alt = isValidNumber(gps[2]) ? parseFloat(gps[2]) : 0.0;

    const accelero_ax = isValidNumber(accelero[0]) ? parseFloat(accelero[0]) : 0.0;
    const accelero_ay = isValidNumber(accelero[1]) ? parseFloat(accelero[1]) : 0.0;
    const accelero_az = isValidNumber(accelero[2]) ? parseFloat(accelero[2]) : 0.0;
    const accelero_gx = isValidNumber(accelero[3]) ? parseFloat(accelero[3]) : 0.0;
    const accelero_gy = isValidNumber(accelero[4]) ? parseFloat(accelero[4]) : 0.0;
    const accelero_gz = isValidNumber(accelero[5]) ? parseFloat(accelero[5]) : 0.0;
    const accelero_speed = isValidNumber(accelero[6]) ? parseFloat(accelero[6]) : 0.0;

    const magnetometer_heading = isValidNumber(magneto[0]) ? parseFloat(magneto[0]) : 0.0;

    await RawData.create({
      gps_lat,
      gps_lon,
      gps_alt,
      accelero_ax,
      accelero_ay,
      accelero_az,
      accelero_gx,
      accelero_gy,
      accelero_gz,
      accelero_speed,
      magnetometer_heading,
      raw_message: dataString
    });

    console.log(`✅ [UDP] Data saved successfully!`);
  } catch (error) {
    console.error(`❌ [UDP] Error processing data: ${error.message}`);
  }
});

udpServer.bind(PORT, () => {
  console.log(`📡 [UDP] Server listening on port ${PORT}`);
});

module.exports = udpServer;
