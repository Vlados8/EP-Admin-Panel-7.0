const { Inquiry, Attachment, ApiKey } = require('../../domain/models');
const AppError = require('../../utils/appError');
const { uploadToR2 } = require('../utils/storage');
const fs = require('fs');

/**
 * Robust webhook handler for MyGo platform (and other external lead sources)
 * Expected format: multipart/form-data with fields and files
 */
exports.handleMyGoWebhook = async (req, res, next) => {
    try {
        console.log('[MyGo Integration] Webhook received');

        // 1. Verify API Key
        const apiKey = req.headers['x-api-key'] || req.query.api_key || req.body.api_key;
        if (!apiKey) {
            console.warn('[MyGo Integration] Missing API Key');
            return next(new AppError('API Key is missing. Please provide it in x-api-key header or as a parameter.', 401));
        }

        const hashedKey = ApiKey.hashKey(apiKey);
        const keyRecord = await ApiKey.findOne({ where: { key_hash: hashedKey, is_active: true } });
        
        if (!keyRecord) {
            console.error('[MyGo Integration] Invalid API Key attempt');
            return next(new AppError('Invalid or inactive API Key.', 403));
        }

        // 2. Extract Data from Body (Multipart or JSON)
        const {
            name, contact_name,
            email, contact_email,
            phone, contact_phone,
            subject, title,
            notes, message,
            category_id, subcategory_id,
            location
        } = req.body;

        // Normalize fields
        const finalName = contact_name || name || 'Unknown MyGo Lead';
        const finalEmail = contact_email || email || null;
        const finalPhone = contact_phone || phone || null;
        const finalTitle = title || subject || `MyGo Lead: ${finalName}`;
        const finalNotes = notes || message || null;

        // 3. Create Inquiry
        const inquiry = await Inquiry.create({
            company_id: keyRecord.company_id,
            contact_name: finalName,
            contact_email: finalEmail,
            contact_phone: finalPhone,
            title: finalTitle,
            notes: finalNotes,
            location: location || null,
            category_id: category_id || 1, // Defaulting to 1 if not provided
            subcategory_id: subcategory_id || null,
            source_website: keyRecord.name_or_domain || 'MyGo Platform',
            source_ip: req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress,
            status: 'new'
        });

        // 4. Handle Uploaded Files (from multer) with R2
        if (req.files && req.files.length > 0) {
            console.log(`[MyGo Integration] Processing ${req.files.length} files for R2`);
            const attachmentRecords = [];
            
            for (const file of req.files) {
                try {
                    const r2Key = `inquiries/${inquiry.id}/${Date.now()}_${file.originalname}`;
                    const fileUrl = await uploadToR2(file.path, r2Key, file.mimetype);

                    attachmentRecords.push({
                        inquiry_id: inquiry.id,
                        email_id: null,
                        file_name: file.originalname,
                        file_url: fileUrl,
                        file_size: file.size,
                        content_type: file.mimetype
                    });

                    // Cleanup local temp
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                } catch (uploadErr) {
                    console.error(`[MyGo Integration] R2 Upload Error for ${file.originalname}:`, uploadErr);
                }
            }

            if (attachmentRecords.length > 0) {
                await Attachment.bulkCreate(attachmentRecords);
            }
        }

        // 5. Update Key Usage Stats
        await keyRecord.update({
            last_used_at: new Date(),
            last_used_ip: req.ip
        });

        console.log(`[MyGo Integration] Inquiry ${inquiry.id} created successfully`);

        res.status(201).json({
            status: 'success',
            data: {
                inquiry_id: inquiry.id,
                message: 'Lead and files successfully received.'
            }
        });

    } catch (err) {
        console.error('[MyGo Integration] Webhook Critical Error:', err);
        next(err);
    }
};
