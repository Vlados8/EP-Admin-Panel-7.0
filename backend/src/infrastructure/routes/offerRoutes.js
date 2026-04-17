const express = require('express');
const router = express.Router();
const projectOfferController = require('../controllers/ProjectOfferController');
const auth = require('../middlewares/auth');

router.use(auth.protect);

router.get('/next-number', projectOfferController.getNextOfferNumber);
router.post('/save', projectOfferController.saveOffer);
router.post('/send', projectOfferController.sendOffer);
router.post('/confirm/:id', projectOfferController.confirmOffer);

module.exports = router;
