const express = require('express');
const fileAssetController = require('../controllers/FileAssetController');
const auth = require('../middlewares/auth');

const router = express.Router();

router.use(auth.protect);

router.get('/', fileAssetController.listFiles);
router.post('/upload', fileAssetController.uploadMiddleware, fileAssetController.uploadFiles);
router.delete('/:id', fileAssetController.deleteFile);

// Folders
router.post('/folders', fileAssetController.createFolder);
router.delete('/folders/:id', fileAssetController.deleteFolder);

// Favorites
router.post('/favorite', fileAssetController.toggleFavorite);

// Sharing
router.post('/toggle-share', fileAssetController.toggleExternalShare);

module.exports = router;
