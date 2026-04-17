const express = require('express');
const supportController = require('../controllers/SupportController');
const apiKeyAuth = require('../middlewares/apiKeyAuth');
const auth = require('../middlewares/auth');
const flexibleAuth = require('../middlewares/flexibleAuth');

const router = express.Router();

// Маршруты поддержки
router.get('/', flexibleAuth, supportController.getTickets);
router.post('/', flexibleAuth, supportController.createTicket); // Гибкий через JWT или API Key
router.get('/:id', auth.protect, supportController.getTicketDetails);
router.patch('/:id/status', auth.protect, auth.restrictTo('Admin', 'Büro'), supportController.updateTicketStatus);
router.post('/:id/responses', auth.protect, auth.restrictTo('Admin', 'Büro'), supportController.addResponse);
router.delete('/:id', auth.protect, auth.restrictTo('Admin', 'Büro'), supportController.deleteTicket);

module.exports = router;
