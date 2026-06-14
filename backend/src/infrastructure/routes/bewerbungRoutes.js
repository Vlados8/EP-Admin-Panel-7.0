const express = require('express');
const router = express.Router();
const bewerbungController = require('../controllers/BewerbungController');
const auth = require('../middlewares/auth');
const apiKeyAuth = require('../middlewares/apiKeyAuth');

// Public endpoint for submitting applications from external websites (Requires API Key)
router.post('/public/:companyId', apiKeyAuth, bewerbungController.createPublicApplication);

// Protected admin endpoints (Auth required)
router.get('/', auth.protect, bewerbungController.getAllApplications);
router.patch('/:id/status', auth.protect, bewerbungController.updateApplicationStatus);
router.delete('/:id', auth.protect, bewerbungController.deleteApplication);

module.exports = router;
