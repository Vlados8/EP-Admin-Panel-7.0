const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/DashboardController');
const authMiddleware = require('../middlewares/auth');

router.use(authMiddleware.protect);

router.get('/summary', dashboardController.getSummary);
router.get('/recent-activity', dashboardController.getRecentActivity);

module.exports = router;
