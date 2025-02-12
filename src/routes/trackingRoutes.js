const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');

router.get('/tracking', trackingController.getTrackingPrediction);

module.exports = router;
