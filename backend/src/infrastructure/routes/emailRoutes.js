const express = require('express');
const fs = require('fs');
const multer = require('multer');
const emailController = require('../controllers/EmailController');
const auth = require('../middlewares/auth');

const router = express.Router();

const path = require('path');

// Multer setup for email attachments
const uploadDir = path.join(__dirname, '../../../../uploads/emails');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ 
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, 'email-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Webhook route - MUST be before auth.protect
router.post('/webhook', upload.any(), emailController.receiveWebhook);

// All email routes below are protected
router.use(auth.protect);

// Account Management (Only Admin/Büro)
router.post('/', auth.checkPermission('MANAGE_EMAIL_ACCOUNTS'), emailController.createEmailAccount);
router.delete('/:id', auth.checkPermission('MANAGE_EMAIL_ACCOUNTS'), emailController.deleteEmailAccount);
router.patch('/:id', auth.checkPermission('MANAGE_EMAIL_ACCOUNTS'), emailController.updateEmailAccount);
router.get('/stats', auth.checkPermission('MANAGE_EMAIL_ACCOUNTS'), emailController.getMailgunStats);

// Email Viewing & Interaction (All roles with VIEW_EMAILS permission, filtered securely in the controller)
router.get('/', auth.checkPermission('VIEW_EMAILS'), emailController.getEmailAccounts);
router.get('/domain', auth.checkPermission('VIEW_EMAILS'), emailController.getDomain);
router.post('/send', auth.checkPermission('VIEW_EMAILS'), upload.array('attachments'), emailController.sendEmail);
router.post('/send-bulk', auth.checkPermission('VIEW_EMAILS'), auth.restrictTo('Admin'), upload.array('attachments'), emailController.sendBulkEmail);

// Message Management
router.get('/messages', auth.checkPermission('VIEW_EMAILS'), emailController.getEmailMessages);
router.patch('/messages/:id/read', auth.checkPermission('VIEW_EMAILS'), emailController.markAsRead);
router.delete('/messages/:id', auth.checkPermission('VIEW_EMAILS'), emailController.deleteMessage);

module.exports = router;
