const express = require('express');
const router = express.Router();
const SystemController = require('../controllers/SystemController');
const { protect, restrictTo } = require('../middlewares/auth');

// Only allow Admin or Superadmin to download backups
router.get('/database/backup', protect, restrictTo('Admin', 'Superadmin'), SystemController.downloadDatabaseBackup);

module.exports = router;
