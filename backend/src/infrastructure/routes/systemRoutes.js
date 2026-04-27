const express = require('express');
const router = express.Router();
const SystemController = require('../controllers/SystemController');
const { protect } = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Only allow Admin or Superadmin to download backups
router.get('/database/backup', protect, roleMiddleware(['Admin', 'Superadmin']), SystemController.downloadDatabaseBackup);

module.exports = router;
