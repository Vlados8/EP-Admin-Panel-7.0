const express = require('express');
const userController = require('../controllers/UserController');

const auth = require('../middlewares/auth');

const router = express.Router();

// Защита всех маршрутов пользователей
router.use(auth.protect);
router.get('/', auth.restrictTo('Admin', 'Büro', 'Projektleiter', 'Gruppenleiter', 'Worker', 'Subcontractor'), userController.getAllUsers);
router.post('/', auth.restrictTo('Admin', 'Büro'), userController.createUser);
router.patch('/:id', auth.restrictTo('Admin', 'Büro'), userController.updateUser);
router.delete('/:id', auth.restrictTo('Admin', 'Büro'), userController.deleteUser);

module.exports = router;
