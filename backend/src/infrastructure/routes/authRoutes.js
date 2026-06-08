const express = require('express');
const authController = require('../controllers/AuthController');

const auth = require('../middlewares/auth');

const router = express.Router();

router.post('/login', authController.login);
router.post('/subcontractor/login', authController.subcontractorLogin);
router.post('/partner/login', authController.partnerLogin);
router.get('/me', auth.protect, authController.getMe);

// Placeholder for other auth routes
// router.post('/refresh-token', authController.refreshToken);
// router.post('/logout', authController.logout);

module.exports = router;
