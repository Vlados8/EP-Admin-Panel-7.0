const { Company } = require('../../domain/models');
const AppError = require('../../utils/appError');
const logger = require('../../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const storageUtil = require('../utils/storage');

// Configure Multer for Company Assets (Logos, Backgrounds)
// Using a temporary directory before uploading to R2
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(process.cwd(), 'uploads/temp');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `company-asset-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'), false);
        }
    }
});

exports.uploadMiddleware = upload.single('asset');

/**
 * Public controller for branding info (no auth)
 */
exports.getPublicSettings = async (req, res, next) => {
    try {
        // Primary company ID for this instance
        const primaryCompanyId = 'd3ba48fd-35d4-466d-93c2-5b23ff3fcc44';
        const company = await Company.findByPk(primaryCompanyId);

        if (!company) {
            // Fallback to first available if primary not found
            const fallbackCompany = await Company.findOne();
            if (!fallbackCompany) {
                return next(new AppError('No company found', 404));
            }
            return res.status(200).json({
                status: 'success',
                data: {
                    name: fallbackCompany.name,
                    settings: fallbackCompany.settings || {}
                }
            });
        }

        res.status(200).json({
            status: 'success',
            data: {
                name: company.name,
                settings: company.settings || {}
            }
        });
    } catch (err) {
        logger.error('Error fetching public company settings:', err);
        next(err);
    }
};

exports.getSettings = async (req, res, next) => {
    try {
        const companyId = req.user.company_id;

        if (!companyId) {
            return next(new AppError('No company associated with this user', 404));
        }

        const company = await Company.findByPk(companyId);

        if (!company) {
            return next(new AppError('Company not found', 404));
        }

        res.status(200).json({
            status: 'success',
            data: {
                name: company.name,
                settings: company.settings || {}
            }
        });
    } catch (err) {
        logger.error('Error fetching company settings:', err);
        next(err);
    }
};

exports.updateSettings = async (req, res, next) => {
    try {
        const companyId = req.user.company_id;
        const { settings } = req.body;

        if (!companyId) {
            return next(new AppError('No company associated with this user', 404));
        }

        if (!settings) {
            return next(new AppError('Settings data is required', 400));
        }

        const company = await Company.findByPk(companyId);

        if (!company) {
            return next(new AppError('Company not found', 404));
        }

        // --- Sync firmName setting with Company.name column ---
        if (settings.firmName && settings.firmName !== company.name) {
            company.name = settings.firmName;
        }

        // Merge existing settings with new ones
        const updatedSettings = {
            ...(company.settings || {}),
            ...settings
        };

        company.settings = updatedSettings;
        await company.save();

        res.status(200).json({
            status: 'success',
            data: {
                name: company.name,
                settings: company.settings
            }
        });
    } catch (err) {
        logger.error('Error updating company settings:', err);
        next(err);
    }
};

/**
 * Handle individual asset uploads to Cloudflare R2
 */
exports.uploadAsset = async (req, res, next) => {
    let localPath = null;
    try {
        if (!req.file) {
            return next(new AppError('Please provide an image file', 400));
        }

        localPath = req.file.path;
        const filename = req.file.filename;
        const contentType = req.file.mimetype;

        // Generate R2 destination key
        const r2Key = `branding/${filename}`;

        // Upload to Cloudflare R2
        const publicUrl = await storageUtil.uploadToR2(localPath, r2Key, contentType);

        // Cleanup local file
        if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
        }

        res.status(200).json({
            status: 'success',
            data: {
                url: publicUrl
            }
        });
    } catch (err) {
        logger.error('Error uploading company asset to R2:', err);
        
        // Cleanup on error
        if (localPath && fs.existsSync(localPath)) {
            try { fs.unlinkSync(localPath); } catch (e) {}
        }

        if (err.message === 'File too large') {
            return next(new AppError('File size exceeded. Max 50MB allowed.', 400));
        }
        next(err);
    }
};
