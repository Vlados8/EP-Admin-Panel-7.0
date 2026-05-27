const express = require('express');
const inquiryController = require('../controllers/InquiryController');
const auth = require('../middlewares/auth');
const apiKeyAuth = require('../middlewares/apiKeyAuth');
const flexibleAuth = require('../middlewares/flexibleAuth');

const router = express.Router();

// Маршруты, требующие JWT (админка/менеджеры)
// Маршруты, требующие JWT (админка/менеджеры) или API-ключ
router.get('/', flexibleAuth, auth.checkPermission('VIEW_INQUIRIES'), inquiryController.getAllInquiries);
router.get('/:id', auth.protect, auth.checkPermission('VIEW_INQUIRIES'), inquiryController.getInquiry);
router.put('/:id', auth.protect, auth.checkPermission('MANAGE_INQUIRIES'), inquiryController.updateInquiry);
router.patch('/:id', auth.protect, auth.checkPermission('MANAGE_INQUIRIES'), inquiryController.updateInquiryStatus);
router.delete('/:id', auth.protect, auth.checkPermission('MANAGE_INQUIRIES'), inquiryController.deleteInquiry);

// Гибкий маршрут создания (JWT для админки или API Key для сайтов)
router.post('/', flexibleAuth, inquiryController.createInquiry);

module.exports = router;
