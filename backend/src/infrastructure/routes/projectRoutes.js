const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');

// Protect all project routes
router.use(auth.protect);
const projectController = require('../controllers/ProjectController');
const multer = require('multer');
const path = require('path');
const projectFileController = require('../controllers/ProjectFileController');

// Temporary storage before we move the files to the dedicated folder inside the controller
const upload = multer({ dest: path.join(__dirname, '../../../../uploads/temp/') });

router.route('/')
    .get(projectController.getAllProjects)
    .post(upload.fields([
        { name: 'photos', maxCount: 20 },
        { name: 'mainImage', maxCount: 1 }
    ]), projectController.createProject);

router.route('/:id')
    .get(projectController.getProjectById)
    .patch(upload.fields([
        { name: 'mainImage', maxCount: 1 }
    ]), projectController.updateProject)
    .delete(projectController.deleteProject);

router.route('/:id/files')
    .get(projectFileController.listFiles)
    .delete(projectFileController.deleteItem);

router.get('/:id/files/download', projectFileController.downloadFile);
router.post('/:id/files/folder', projectFileController.createFolder);
router.patch('/:id/files/permissions', projectFileController.updatePermissions);
router.post('/:id/files/toggle-share', projectFileController.togglePublicShare);
router.post('/:id/files/upload', projectFileController.uploadMiddleware, projectFileController.uploadFiles);

module.exports = router;
