/**
 * test/runUdpService.js
 * File ini digunakan untuk menjalankan UDP service dan mengirimkan pesan sample.
 */

const dgram = require('dgram');
const { config } = require('../src/config/config');
// Import udpService, sehingga server UDP langsung dijalankan (bind pada port yang telah ditentukan)
require('../src/services/udpService');

// Untuk memastikan server UDP sudah siap mendengarkan, gunakan timeout singkat
setTimeout(() => {
  // Membuat UDP client untuk mengirim pesan sample ke server UDP
  const client = dgram.createSocket('udp4');

  // Contoh pesan sensor, sesuai format:
  // "gps:lat,lon,alt,| accelero:ax,ay,az,gx,gy,gz,speed,| magnetometer:heading"
  const sampleMessage = "gps:1.234,2.345,3.456,| accelero:0.1,0.2,0.3,0.4,0.5,0.6,50,| magnetometer:90";

  client.send(sampleMessage, config.udpPort, 'localhost', (err) => {
    if (err) {
      console.error("Error saat mengirim pesan UDP:", err);
    } else {
      console.log("Pesan UDP sample berhasil dikirim.");
    }
    client.close();
  });
}, 1000);
