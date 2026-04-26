const express = require('express');
const router = express.Router();
const ReonicController = require('../controllers/ReonicController');
const auth = require('../middlewares/auth');

// Authenticated API Routes
router.get('/settings', auth.protect, ReonicController.getSettings);
router.post('/settings', auth.protect, ReonicController.saveSettings);

router.get('/leads', auth.protect, ReonicController.getLeads);
router.post('/leads', auth.protect, ReonicController.createLead);
router.put('/leads/:id/status', auth.protect, ReonicController.updateLeadStatus);

router.post('/sync', auth.protect, ReonicController.syncLeads);

// Public Webhook Route (Authentication depends on Webhook signature validation)
router.post('/webhook/:companyId', express.json({type: 'application/json'}), ReonicController.webhookHandler);

module.exports = router;
