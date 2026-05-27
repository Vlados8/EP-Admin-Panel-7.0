const express = require('express');
const notificationController = require('../controllers/NotificationController');
const auth = require('../middlewares/auth');

const router = express.Router();

// All notification routes require authentication
router.use(auth.protect);

// Main notification endpoints
router.get('/', notificationController.getNotifications);
router.patch('/mark-read', notificationController.markNotificationsRead);

// Preferences toggles
router.get('/settings', notificationController.getSettings);
router.post('/settings', notificationController.updateSettings);

// Push token registration
router.post('/push-token', notificationController.registerPushToken);

module.exports = router;
