const express = require('express');
const router = express.Router();
const TimeTrackingController = require('../controllers/TimeTrackingController');
const auth = require('../middlewares/auth');

// Public endpoints for Terminal (PIN entry)
router.post('/check-in', TimeTrackingController.checkIn);
router.post('/check-out', TimeTrackingController.checkOut);

// Admin endpoints
router.get('/logs', auth.protect, TimeTrackingController.getLogs);
router.post('/logs', auth.protect, TimeTrackingController.createLog);
router.patch('/logs/:id', auth.protect, TimeTrackingController.updateLog);
router.delete('/logs/:id', auth.protect, TimeTrackingController.deleteLog);
router.get('/report', auth.protect, TimeTrackingController.generateReport);

module.exports = router;
