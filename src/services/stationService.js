// src/services/stationService.js
const stationModel = require('../models/stationModel');

async function getActiveStations() {
  try {
    const stations = await stationModel.findAll({ where: { active: true } });
    return stations;
  } catch (error) {
    console.error("Error fetching active stations:", error);
    return [];
  }
}

module.exports = { getActiveStations };
