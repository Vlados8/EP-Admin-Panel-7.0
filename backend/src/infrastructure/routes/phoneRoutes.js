const express = require('express');
const phoneController = require('../controllers/PhoneController');
const telephonyController = require('../controllers/TelephonyController');
const auth = require('../middlewares/auth');

const router = express.Router();

router.get('/logs', auth.protect, phoneController.getCallLogs);
router.get('/logs/user/:userId', auth.protect, phoneController.getUserLogs);
router.get('/all-logs', auth.protect, phoneController.getAllCallLogs);
router.post('/logs', auth.protect, phoneController.createLog);

router.get('/settings', auth.protect, phoneController.getSettings);
router.patch('/settings', auth.protect, phoneController.updateSettings);

// Advanced Telephony
router.patch('/status', auth.protect, phoneController.updateCallStatus);
router.post('/transfer', auth.protect, phoneController.transferCall);

router.get('/history/:number', auth.protect, phoneController.getNumberHistory);

// Public webhook with its own security
router.post('/webhook', phoneController.handleWebhook);

module.exports = router;
