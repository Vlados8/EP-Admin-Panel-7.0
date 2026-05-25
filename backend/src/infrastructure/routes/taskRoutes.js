const express = require('express');
const taskController = require('../controllers/TaskController');
const auth = require('../middlewares/auth');
const { getUploader } = require('../middlewares/uploadMiddleware');

const upload = getUploader('tasks');
const router = express.Router();

// Protect all task routes
router.use(auth.protect);

router
    .route('/')
    .get(taskController.getTasks)
    .post(auth.checkPermission('MANAGE_TASKS'), upload.array('files', 10), taskController.createTask);

router
    .route('/:id')
    .patch(upload.array('files', 10), taskController.updateTask)
    .delete(taskController.deleteTask);

module.exports = router;
