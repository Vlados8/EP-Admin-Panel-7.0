const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { fixEncoding, getSafeStorageName } = require('../../utils/fileUtils');

/**
 * Creates a Multer storage engine for a specific subfolder within 'uploads'
 * @param {string} folder - Subfolder name (e.g., 'notizen', 'tasks')
 */
const createStorage = (folder) => {
    return multer.diskStorage({
        destination: (req, file, cb) => {
            // Corrected to 4 levels up to reach project root 'admin' from 'backend/src/infrastructure/middlewares'
            const uploadPath = path.join(__dirname, '../../../../uploads', folder);
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }
            cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
            // Fix encoding of originalname in place so it can be used correctly in controllers
            file.originalname = fixEncoding(file.originalname);
            // Use unique ID for storage
            cb(null, getSafeStorageName(file.originalname));
        }
    });
};

/**
 * Returns a Multer instance for a specific task area
 * @param {string} area - One of 'notizen' or 'tasks'
 */
const getUploader = (area) => {
    return multer({
        storage: createStorage(area),
        limits: {
            fileSize: 100 * 1024 * 1024 // 100MB limit
        }
    });
};

module.exports = { getUploader };
