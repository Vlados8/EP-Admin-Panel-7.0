const express = require('express');
const router = express.Router();
const publicFileController = require('../controllers/PublicFileController');
const fileAssetController = require('../controllers/FileAssetController');

router.get('/shared-folder/:token', publicFileController.getSharedFolder);
router.get('/shared-folder/:token/download', publicFileController.downloadSharedFile);

// General File Manager sharing
router.get('/assets/:token', fileAssetController.getSharedContent);

module.exports = router;
