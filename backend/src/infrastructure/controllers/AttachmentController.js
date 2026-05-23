const { Attachment } = require('../../domain/models');
const AppError = require('../../utils/appError');
const fs = require('fs');
const path = require('path');
const { deleteFromR2 } = require('../utils/storage');

exports.deleteAttachment = async (req, res, next) => {
    try {
        const attachment = await Attachment.findByPk(req.params.id);

        if (!attachment) {
            return next(new AppError('Anhang nicht gefunden', 404));
        }

        // Optional: Check permissions here if needed
        // For now, allow deletion if user is authenticated (protected by route)

        const filePath = path.join(__dirname, '../../../../', attachment.file_url);

        if (attachment.file_url && attachment.file_url.startsWith('http')) {
            // 1. Delete compressed file (file_url)
            try {
                const urlObj = new URL(attachment.file_url);
                const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                await deleteFromR2(key);
            } catch (err) { console.error('Error deleting file_url from R2:', err); }

            // 2. Delete original file (original_url)
            if (attachment.original_url && attachment.original_url !== attachment.file_url) {
                try {
                    const urlObj = new URL(attachment.original_url);
                    const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                    await deleteFromR2(key);
                } catch (err) { console.error('Error deleting original_url from R2:', err); }
            }

            // 3. Delete thumbnail (thumb_url)
            if (attachment.thumb_url) {
                try {
                    const urlObj = new URL(attachment.thumb_url);
                    const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                    await deleteFromR2(key);
                } catch (err) { console.error('Error deleting thumb_url from R2:', err); }
            }
        } else if (attachment.file_url) {
            // Delete from disk
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // Delete from DB
        await attachment.destroy();

        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (err) {
        next(err);
    }
};
