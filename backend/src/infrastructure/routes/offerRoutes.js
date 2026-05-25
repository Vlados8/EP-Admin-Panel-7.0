const express = require('express');
const router = express.Router();
const projectOfferController = require('../controllers/ProjectOfferController');
const auth = require('../middlewares/auth');

router.use(auth.protect);

router.get('/next-number', projectOfferController.getNextOfferNumber);
router.post('/save', auth.restrictTo('Admin', 'Büro', 'Projektleiter', 'Gruppenleiter'), projectOfferController.saveOffer);
router.post('/send', auth.restrictTo('Admin', 'Büro', 'Projektleiter', 'Gruppenleiter'), projectOfferController.sendOffer);
router.post('/confirm/:id', auth.restrictTo('Admin', 'Büro', 'Projektleiter', 'Gruppenleiter'), projectOfferController.confirmOffer);

module.exports = router;
