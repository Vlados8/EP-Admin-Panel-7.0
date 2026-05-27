const express = require('express');
const categoryController = require('../controllers/CategoryController');
const auth = require('../middlewares/auth');
const flexibleAuth = require('../middlewares/flexibleAuth');

const router = express.Router();

// Categories
router
    .route('/')
    .get(flexibleAuth, auth.checkPermission('VIEW_CATEGORIES'), categoryController.getAllCategories)
    .post(auth.protect, auth.restrictTo('Admin', 'Büro'), categoryController.createCategory);

router
    .route('/:id')
    .patch(auth.protect, auth.restrictTo('Admin', 'Büro'), categoryController.updateCategory)
    .delete(auth.protect, auth.restrictTo('Admin', 'Büro'), categoryController.deleteCategory);

// Subcategories
router.post('/subcategories', auth.protect, auth.restrictTo('Admin', 'Büro'), categoryController.createSubcategory);
router.patch('/subcategories/:id', auth.protect, auth.restrictTo('Admin', 'Büro'), categoryController.updateSubcategory);
router.delete('/subcategories/:id', auth.protect, auth.restrictTo('Admin', 'Büro'), categoryController.deleteSubcategory);

// Questions
router.post('/questions', auth.protect, auth.restrictTo('Admin', 'Büro'), categoryController.createQuestion);
router.patch('/questions/:id', auth.protect, auth.restrictTo('Admin', 'Büro'), categoryController.updateQuestion);
router.delete('/questions/:id', auth.protect, auth.restrictTo('Admin', 'Büro'), categoryController.deleteQuestion);

// Answers
router.post('/answers', auth.protect, auth.restrictTo('Admin', 'Büro'), categoryController.createAnswer);
router.patch('/answers/:id', auth.protect, auth.restrictTo('Admin', 'Büro'), categoryController.updateAnswer);
router.delete('/answers/:id', auth.protect, auth.restrictTo('Admin', 'Büro'), categoryController.deleteAnswer);

module.exports = router;
