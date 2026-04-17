const { Attachment } = require('../../domain/models');
const AppError = require('../../utils/appError');
const fs = require('fs');
const path = require('path');

exports.deleteAttachment = async (req, res, next) => {
    try {
        const attachment = await Attachment.findByPk(req.params.id);

        if (!attachment) {
            return next(new AppError('Anhang nicht gefunden', 404));
        }

        // Optional: Check permissions here if needed
        // For now, allow deletion if user is authenticated (protected by route)

        const filePath = path.join(__dirname, '../../../../', attachment.file_url);

        // Delete from disk
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
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
