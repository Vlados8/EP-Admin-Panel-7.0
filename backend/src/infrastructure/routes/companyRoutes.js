const express = require('express');
const companyController = require('../controllers/CompanyController');
const auth = require('../middlewares/auth');

const router = express.Router();

// Public route for login page/shared views branding
router.get('/public', companyController.getPublicSettings);

// protect all routes below
router.use(auth.protect);

// Anyone in the company can view company settings
router.get('/', companyController.getSettings);

// Only admins can update the company settings
router.patch('/settings', auth.restrictTo('Admin'), companyController.updateSettings);

// Asset upload (logo, bg, etc)
router.post('/upload-asset', auth.restrictTo('Admin'), companyController.uploadMiddleware, companyController.uploadAsset);

module.exports = router;
