require('dotenv').config();
const express = require('express');
const trackingRoutes = require('./routes/trackingRoutes');
const udpService = require('./services/udpService'); // Start UDP Server
const { processAndSendData } = require('./services/realtimeService'); // Start Worker

const app = express();
const PORT = process.env.PORT || 3000;

// API Metadata
const API_VERSION = "0.0.4";
const API_ENV = process.env.API_ENV || "dev";
const AUTHOR = "mj";
const BUILD_DATE = new Date().toISOString();

app.use(express.json());
app.use('/api', trackingRoutes);

// Endpoint Metadata API
app.get('/api', (req, res) => {
  res.json({
    meta: {
      version: API_VERSION,
      api_env: API_ENV,
      author: AUTHOR,
      build_date: BUILD_DATE
    },
    data: ["hi"]
  });
});

// Mulai Worker untuk pengiriman data ke cloud otomatis
processAndSendData();

// Jalankan HTTP Server
app.listen(PORT, () => {
  console.log(`🚀 HTTP Server running on port ${PORT}`);
});

module.exports = app;
